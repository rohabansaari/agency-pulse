<?php

namespace Tests\Feature;

use App\Enums\ProjectBillingType;
use App\Enums\TimeEntryStatus;
use App\Enums\TimeEntryType;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $ali;

    private Project $alpha;

    private Project $beta;

    private Project $internal;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        Carbon::setTestNow(Carbon::parse('2026-11-20 12:00:00'));

        $this->admin = User::factory()->admin()->create();
        $orgId = $this->admin->organization_id;
        $this->ali = User::factory()->create(['organization_id' => $orgId, 'name' => 'Ali']);

        $this->alpha = Project::factory()->create([
            'organization_id' => $orgId,
            'name' => 'Alpha Website',
            'client_name' => 'Acme',
            'billing_type' => ProjectBillingType::Hourly,
            'hourly_rate' => 1500,
        ]);
        $this->beta = Project::factory()->create([
            'organization_id' => $orgId,
            'name' => 'Beta Rebrand',
            'client_name' => 'Acme',
            'billing_type' => ProjectBillingType::Fixed,
            'hourly_rate' => null,
            'budget_amount' => 20000,
            'budget_hours' => 40,
        ]);
        $this->internal = Project::factory()->create([
            'organization_id' => $orgId,
            'name' => 'Internal Tools',
            'client_name' => 'In-house',
            'billing_type' => ProjectBillingType::NonBillable,
        ]);

        // 10h approved on Alpha (8h timer + 2h approved manual), plus work that must not be billed.
        $this->work($this->alpha, 8, '2026-11-03 09:00');
        $this->work($this->alpha, 2, '2026-11-04 09:00', TimeEntryType::Manual, TimeEntryStatus::Approved);
        $this->work($this->alpha, 3, '2026-11-05 09:00', TimeEntryType::Manual, TimeEntryStatus::Pending);
        $this->work($this->beta, 5, '2026-11-06 09:00');
        $this->work($this->internal, 4, '2026-11-06 14:00');

        Sanctum::actingAs($this->admin);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function headers(?User $user = null): array
    {
        return ['X-Organization-Id' => (string) ($user ?? $this->admin)->organization_id];
    }

    private function work(Project $project, float $hours, string $start, TimeEntryType $type = TimeEntryType::Tracked, TimeEntryStatus $status = TimeEntryStatus::Stopped): void
    {
        $startTime = Carbon::parse($start);

        TimeEntry::create([
            'user_id' => $this->ali->id,
            'organization_id' => $this->ali->organization_id,
            'type' => $type,
            'project_id' => $project->id,
            'duration' => (int) round($hours * 3600),
            'description' => $type === TimeEntryType::Manual ? 'Client workshop' : null,
            'status' => $status,
            'start_time' => $startTime,
            'end_time' => $startTime->copy()->addSeconds((int) round($hours * 3600)),
        ]);
    }

    private function create(array $body = ['client_name' => 'Acme']): \Illuminate\Testing\TestResponse
    {
        return $this->withHeaders($this->headers())->postJson('/api/v1/invoices', $body);
    }

    public function test_unbilled_work_lists_approved_hours_and_fixed_fees_per_client(): void
    {
        $response = $this->withHeaders($this->headers())->getJson('/api/v1/invoices/unbilled')->assertOk();

        $clients = collect($response->json('clients'))->keyBy('client_name');
        $this->assertSame(['Acme'], $clients->keys()->all(), 'Internal work is never invoiced.');
        // 10 approved hours × 1,500 + the 20,000 fixed fee. Pending manual time is left out.
        $this->assertEqualsWithDelta(10, $clients['Acme']['hours'], 0.001);
        $this->assertEqualsWithDelta(35000, $clients['Acme']['amount'], 0.01);
    }

    public function test_invoice_bills_each_approved_hour_once(): void
    {
        $invoice = $this->create()->assertCreated()
            ->assertJsonPath('number', 'INV-0001')
            ->assertJsonPath('status', 'draft')
            ->json();

        $this->assertCount(2, $invoice['lines']);
        $this->assertEqualsWithDelta(35000, $invoice['subtotal'], 0.01);
        $this->assertEqualsWithDelta(10, $invoice['hours_billed'], 0.001);
        $this->assertSame('2026-12-04', $invoice['due_date'], 'Due 14 days after issue by default.');

        // Nothing left to bill for Acme, so a second invoice is refused.
        $this->create()->assertStatus(422);
        $this->assertSame([], $this->withHeaders($this->headers())->getJson('/api/v1/invoices/unbilled')->json('clients'));

        // New approved work becomes billable on the next invoice, with the next number.
        $this->work($this->alpha, 1, '2026-11-18 09:00');
        $second = $this->create()->assertCreated()->assertJsonPath('number', 'INV-0002')->json();
        $this->assertCount(1, $second['lines']);
        $this->assertEqualsWithDelta(1500, $second['total'], 0.01);
    }

    public function test_period_limits_which_hours_are_billed(): void
    {
        $invoice = $this->create(['client_name' => 'Acme', 'start_date' => '04/11/2026', 'end_date' => '30/11/2026'])
            ->assertCreated()
            ->json();

        $hourly = collect($invoice['lines'])->firstWhere('kind', 'hourly');
        $this->assertEqualsWithDelta(2, $hourly['quantity'], 0.001);
        $this->assertSame('2026-11-04', $invoice['period_start']);
    }

    public function test_draft_can_be_edited_and_totals_include_discount_and_tax(): void
    {
        $invoice = $this->create()->json();
        $lines = collect($invoice['lines'])->map(fn ($line) => [
            'id' => $line['id'],
            'description' => $line['description'],
            'quantity' => $line['quantity'],
            'unit_price' => $line['unit_price'],
        ])->all();
        $lines[] = ['description' => 'Stock photography', 'quantity' => 2, 'unit_price' => 2500];

        $updated = $this->withHeaders($this->headers())->putJson("/api/v1/invoices/{$invoice['id']}", [
            'lines' => $lines,
            'discount' => 1000,
            'tax_percent' => 10,
            'due_date' => '15/12/2026',
            'bill_to' => "Acme Foods\nAccounts payable",
        ])->assertOk()->json();

        // 35,000 + 5,000 − 1,000 = 39,000, plus 10% tax = 42,900.
        $this->assertEqualsWithDelta(40000, $updated['subtotal'], 0.01);
        $this->assertEqualsWithDelta(3900, $updated['tax_amount'], 0.01);
        $this->assertEqualsWithDelta(42900, $updated['total'], 0.01);
        $this->assertSame('2026-12-15', $updated['due_date']);
        $this->assertCount(3, $updated['lines']);
    }

    public function test_removing_the_hours_line_puts_those_hours_back_in_unbilled(): void
    {
        $invoice = $this->create()->json();
        $fixed = collect($invoice['lines'])->firstWhere('kind', 'fixed');

        $this->withHeaders($this->headers())->putJson("/api/v1/invoices/{$invoice['id']}", [
            'lines' => [[
                'id' => $fixed['id'],
                'description' => $fixed['description'],
                'quantity' => 1,
                'unit_price' => $fixed['unit_price'],
            ]],
        ])->assertOk()->assertJsonPath('hours_billed', 0);

        $clients = $this->withHeaders($this->headers())->getJson('/api/v1/invoices/unbilled')->json('clients');
        $this->assertEqualsWithDelta(15000, $clients[0]['amount'], 0.01);
    }

    public function test_send_pay_and_overdue(): void
    {
        $id = $this->create()->json('id');

        $this->withHeaders($this->headers())->postJson("/api/v1/invoices/{$id}/send")
            ->assertOk()->assertJsonPath('status', 'sent');

        // Sent invoices are locked.
        $this->withHeaders($this->headers())->putJson("/api/v1/invoices/{$id}", ['discount' => 5])->assertStatus(422);

        Carbon::setTestNow(Carbon::parse('2026-12-10 12:00:00'));
        $this->withHeaders($this->headers())->getJson('/api/v1/invoices')
            ->assertOk()
            ->assertJsonPath('summary.overdue_count', 1)
            ->assertJsonPath('invoices.0.overdue', true);

        $this->withHeaders($this->headers())->postJson("/api/v1/invoices/{$id}/payments", ['amount' => 10000, 'paid_on' => '10/12/2026'])
            ->assertOk()->assertJsonPath('status', 'sent')->assertJsonPath('balance', 25000);
        $this->withHeaders($this->headers())->postJson("/api/v1/invoices/{$id}/payments", ['amount' => 30000])->assertStatus(422);
        $this->withHeaders($this->headers())->postJson("/api/v1/invoices/{$id}/payments", ['amount' => 25000])
            ->assertOk()->assertJsonPath('status', 'paid')->assertJsonPath('balance', 0);

        $this->withHeaders($this->headers())->getJson('/api/v1/invoices')
            ->assertJsonPath('summary.paid_this_month', 35000)
            ->assertJsonPath('summary.outstanding', 0);

        // A paid invoice can't be voided.
        $this->withHeaders($this->headers())->postJson("/api/v1/invoices/{$id}/void")->assertStatus(422);
    }

    public function test_void_and_delete_release_the_work(): void
    {
        $id = $this->create()->json('id');
        $this->withHeaders($this->headers())->postJson("/api/v1/invoices/{$id}/send")->assertOk();
        $this->withHeaders($this->headers())->postJson("/api/v1/invoices/{$id}/void")->assertOk()->assertJsonPath('status', 'void');
        $this->assertSame(0, TimeEntry::query()->whereNotNull('invoice_id')->count());

        // Voided fixed fees and hours can be billed again.
        $again = $this->create()->assertCreated()->json();
        $this->assertEqualsWithDelta(35000, $again['total'], 0.01);

        $this->withHeaders($this->headers())->deleteJson("/api/v1/invoices/{$again['id']}")->assertOk();
        $this->assertSame(0, TimeEntry::query()->whereNotNull('invoice_id')->count());
        $this->withHeaders($this->headers())->getJson("/api/v1/invoices/{$again['id']}")->assertNotFound();
    }

    public function test_settings_number_the_next_invoice(): void
    {
        $this->withHeaders($this->headers())->putJson('/api/v1/invoices/settings', [
            'business_name' => 'Lumen Studio',
            'address' => '12 Mall Road, Lahore',
            'number_prefix' => 'LS-',
            'next_number' => 41,
            'default_due_days' => 30,
            'default_tax_percent' => 5,
        ])->assertOk()->assertJsonPath('business_name', 'Lumen Studio');

        $invoice = $this->create()->assertCreated()
            ->assertJsonPath('number', 'LS-0041')
            ->assertJsonPath('due_date', '2026-12-20')
            ->assertJsonPath('settings.address', '12 Mall Road, Lahore')
            ->json();
        $this->assertEqualsWithDelta(36750, $invoice['total'], 0.01);
    }

    public function test_only_admins_of_the_same_company_can_use_invoices(): void
    {
        $id = $this->create()->json('id');

        Sanctum::actingAs($this->ali);
        $this->withHeaders($this->headers($this->ali))->getJson('/api/v1/invoices')->assertForbidden();

        $other = User::factory()->admin()->create();
        Sanctum::actingAs($other);
        $this->withHeaders($this->headers($other))->getJson("/api/v1/invoices/{$id}")->assertNotFound();
        $this->withHeaders($this->headers($other))->getJson('/api/v1/invoices/unbilled')
            ->assertOk()->assertJsonPath('clients', []);
    }
}
