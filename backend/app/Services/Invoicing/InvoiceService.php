<?php

namespace App\Services\Invoicing;

use App\Enums\InvoiceLineKind;
use App\Enums\InvoiceStatus;
use App\Enums\ProjectBillingType;
use App\Enums\TimeEntryType;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Organization;
use App\Models\Project;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Client invoices built from approved work.
 *
 * - Hourly projects bill approved hours (stopped timer sessions and approved
 *   manual entries) × the project's hourly rate. Billed entries are linked to
 *   the invoice (time_entries.invoice_id) so an hour is never billed twice.
 * - Fixed-fee projects bill whatever part of the fee no earlier invoice
 *   (draft, sent or paid) has billed yet.
 * - Internal (non-billable) projects are never invoiced.
 *
 * Only drafts can be edited or deleted. Voiding or deleting an invoice
 * releases its hours so they can be billed again.
 */
class InvoiceService
{
    public const DEFAULT_SETTINGS = [
        'business_name' => null,
        'address' => '',
        'tax_id' => '',
        'payment_details' => '',
        'default_due_days' => 14,
        'default_tax_percent' => 0,
        'number_prefix' => 'INV-',
        'next_number' => 1,
    ];

    /* ------------------------------------------------------------------ */
    /* Settings                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * @return array<string, mixed>
     */
    public function settings(?Organization $organization = null): array
    {
        $organization ??= TenantContext::get();
        $settings = array_merge(self::DEFAULT_SETTINGS, $organization->invoice_settings ?? []);
        $settings['business_name'] = $settings['business_name'] ?: $organization->name;

        return $settings;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updateSettings(array $data): array
    {
        $organization = TenantContext::get();
        $current = array_merge(self::DEFAULT_SETTINGS, $organization->invoice_settings ?? []);
        $allowed = array_intersect_key($data, self::DEFAULT_SETTINGS);
        $organization->forceFill(['invoice_settings' => array_merge($current, $allowed)])->save();

        return $this->settings($organization->refresh());
    }

    /* ------------------------------------------------------------------ */
    /* Unbilled work                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * Approved, not yet invoiced work per client, up to $until (default: now).
     *
     * @return list<array<string, mixed>>
     */
    public function unbilled(?Carbon $until = null): array
    {
        $until ??= Carbon::now();
        $clients = [];

        foreach ($this->billableProjects() as $project) {
            $line = $this->projectLine($project, null, $until);

            if ($line === null) {
                continue;
            }

            $client = $project->client_name;
            $clients[$client] ??= [
                'client_name' => $client,
                'hours' => 0.0,
                'amount' => 0.0,
                'first_date' => null,
                'last_date' => null,
                'projects' => [],
            ];

            $clients[$client]['hours'] += $line['hours'];
            $clients[$client]['amount'] += $line['amount'];
            $clients[$client]['projects'][] = [
                'id' => $project->id,
                'name' => $project->name,
                'billing_type' => $project->billingType()->value,
                'hours' => round($line['hours'], 2),
                'amount' => round($line['amount'], 2),
            ];

            foreach (['first_date' => 'min', 'last_date' => 'max'] as $key => $fn) {
                if ($line[$key] !== null) {
                    $clients[$client][$key] = $clients[$client][$key] === null
                        ? $line[$key]
                        : $fn($clients[$client][$key], $line[$key]);
                }
            }
        }

        return collect($clients)
            ->map(fn (array $row) => [...$row, 'hours' => round($row['hours'], 2), 'amount' => round($row['amount'], 2)])
            ->sortByDesc('amount')
            ->values()
            ->all();
    }

    /* ------------------------------------------------------------------ */
    /* Create                                                              */
    /* ------------------------------------------------------------------ */

    /**
     * Draft invoice for one client's approved, uninvoiced work in a period.
     */
    public function createFromWork(string $clientName, ?Carbon $periodStart, Carbon $periodEnd, User $creator): Invoice
    {
        $projects = $this->billableProjects()->where('client_name', $clientName)->values();

        if ($projects->isEmpty()) {
            throw ValidationException::withMessages([
                'client_name' => ["{$clientName} has no hourly or fixed-fee projects to invoice."],
            ]);
        }

        return DB::transaction(function () use ($projects, $clientName, $periodStart, $periodEnd, $creator) {
            $organization = Organization::query()->lockForUpdate()->findOrFail(TenantContext::id());
            $settings = $this->settings($organization);

            $lines = [];
            $entryIdsByProject = [];

            foreach ($projects as $project) {
                $line = $this->projectLine($project, $periodStart, $periodEnd, lock: true);

                if ($line === null) {
                    continue;
                }

                $lines[] = $line;
                $entryIdsByProject[$project->id] = $line['entry_ids'];
            }

            if ($lines === []) {
                throw ValidationException::withMessages([
                    'client_name' => ["There is no approved, uninvoiced work for {$clientName} in this period."],
                ]);
            }

            $today = Carbon::today();
            $invoice = Invoice::query()->create([
                'organization_id' => $organization->id,
                'number' => $this->takeNumber($organization, $settings),
                'client_name' => $clientName,
                'status' => InvoiceStatus::Draft,
                'issue_date' => $today,
                'due_date' => $today->copy()->addDays((int) $settings['default_due_days']),
                'period_start' => $periodStart?->toDateString() ?? collect($lines)->pluck('first_date')->filter()->min(),
                'period_end' => $periodEnd->toDateString(),
                'currency' => 'PKR',
                'tax_percent' => (float) $settings['default_tax_percent'],
                'created_by' => $creator->id,
            ]);

            foreach ($lines as $position => $line) {
                $invoice->lines()->create([
                    'project_id' => $line['project_id'],
                    'kind' => $line['kind'],
                    'description' => $line['description'],
                    'quantity' => $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'amount' => round($line['quantity'] * $line['unit_price'], 2),
                    'position' => $position,
                ]);
            }

            $entryIds = array_merge(...array_values($entryIdsByProject) ?: [[]]);
            if ($entryIds !== []) {
                TimeEntry::query()->whereIn('id', $entryIds)->update(['invoice_id' => $invoice->id]);
            }

            return $this->recalculate($invoice);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Edit                                                                */
    /* ------------------------------------------------------------------ */

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Invoice $invoice, array $data): Invoice
    {
        $this->assertDraft($invoice, 'edited');

        return DB::transaction(function () use ($invoice, $data) {
            $invoice->fill(array_intersect_key($data, array_flip([
                'client_name', 'bill_to', 'issue_date', 'due_date', 'notes', 'tax_percent', 'discount',
            ])));
            $invoice->save();

            if (array_key_exists('lines', $data)) {
                $this->replaceLines($invoice, $data['lines']);
            }

            return $this->recalculate($invoice);
        });
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function replaceLines(Invoice $invoice, array $rows): void
    {
        $existing = $invoice->lines()->get()->keyBy('id');
        $keep = [];

        foreach (array_values($rows) as $position => $row) {
            $quantity = round((float) $row['quantity'], 2);
            $unitPrice = round((float) $row['unit_price'], 2);
            $attributes = [
                'description' => trim((string) $row['description']),
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'amount' => round($quantity * $unitPrice, 2),
                'position' => $position,
            ];

            $id = isset($row['id']) ? (int) $row['id'] : null;

            if ($id !== null && $existing->has($id)) {
                $existing[$id]->update($attributes);
                $keep[] = $id;

                continue;
            }

            $created = $invoice->lines()->create([...$attributes, 'kind' => InvoiceLineKind::Custom]);
            $keep[] = $created->id;
        }

        $removed = $existing->except($keep);

        foreach ($removed as $line) {
            // Removing a project's hours line puts those hours back in "unbilled".
            if ($line->kind === InvoiceLineKind::Hourly && $line->project_id !== null) {
                TimeEntry::query()
                    ->where('invoice_id', $invoice->id)
                    ->where('project_id', $line->project_id)
                    ->update(['invoice_id' => null]);
            }

            $line->delete();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Status changes                                                      */
    /* ------------------------------------------------------------------ */

    public function markSent(Invoice $invoice): Invoice
    {
        $this->assertDraft($invoice, 'sent');

        if ($invoice->lines()->count() === 0 || (float) $invoice->total <= 0) {
            throw ValidationException::withMessages([
                'invoice' => ['Add at least one line with an amount before sending.'],
            ]);
        }

        $invoice->update(['status' => InvoiceStatus::Sent, 'sent_at' => Carbon::now()]);

        return $invoice->refresh();
    }

    public function recordPayment(Invoice $invoice, float $amount, Carbon $paidOn): Invoice
    {
        if ($invoice->status !== InvoiceStatus::Sent) {
            throw ValidationException::withMessages([
                'invoice' => ['Payments can only be recorded on a sent invoice.'],
            ]);
        }

        if ($amount <= 0 || $amount > $invoice->balance() + 0.004) {
            throw ValidationException::withMessages([
                'amount' => [sprintf('Enter an amount between 0 and the balance of %s.', number_format($invoice->balance(), 2))],
            ]);
        }

        $paid = round((float) $invoice->amount_paid + $amount, 2);
        $fullyPaid = $paid >= (float) $invoice->total - 0.004;

        $invoice->update([
            'amount_paid' => $paid,
            'status' => $fullyPaid ? InvoiceStatus::Paid : InvoiceStatus::Sent,
            'paid_at' => $fullyPaid ? $paidOn : null,
        ]);

        return $invoice->refresh();
    }

    public function void(Invoice $invoice): Invoice
    {
        if (! in_array($invoice->status, [InvoiceStatus::Draft, InvoiceStatus::Sent], true)) {
            throw ValidationException::withMessages([
                'invoice' => ['Only draft or unpaid invoices can be voided.'],
            ]);
        }

        if ((float) $invoice->amount_paid > 0) {
            throw ValidationException::withMessages([
                'invoice' => ['This invoice has payments recorded, so it can no longer be voided.'],
            ]);
        }

        DB::transaction(function () use ($invoice) {
            TimeEntry::query()->where('invoice_id', $invoice->id)->update(['invoice_id' => null]);
            $invoice->update(['status' => InvoiceStatus::Void, 'voided_at' => Carbon::now()]);
        });

        return $invoice->refresh();
    }

    public function delete(Invoice $invoice): void
    {
        $this->assertDraft($invoice, 'deleted');

        DB::transaction(function () use ($invoice) {
            TimeEntry::query()->where('invoice_id', $invoice->id)->update(['invoice_id' => null]);
            $invoice->delete();
        });
    }

    /* ------------------------------------------------------------------ */
    /* Summary + serialisation                                             */
    /* ------------------------------------------------------------------ */

    /**
     * @return array<string, mixed>
     */
    public function summary(): array
    {
        $today = Carbon::today();
        $open = Invoice::query()->where('status', InvoiceStatus::Sent)->get(['total', 'amount_paid', 'due_date', 'status']);
        $overdue = $open->filter(fn (Invoice $invoice) => $invoice->due_date->lt($today));

        return [
            'outstanding' => round($open->sum(fn (Invoice $invoice) => $invoice->balance()), 2),
            'outstanding_count' => $open->count(),
            'overdue' => round($overdue->sum(fn (Invoice $invoice) => $invoice->balance()), 2),
            'overdue_count' => $overdue->count(),
            'paid_this_month' => round((float) Invoice::query()
                ->where('status', InvoiceStatus::Paid)
                ->whereBetween('paid_at', [$today->copy()->startOfMonth(), $today->copy()->endOfMonth()->endOfDay()])
                ->sum('total'), 2),
            'drafts' => Invoice::query()->where('status', InvoiceStatus::Draft)->count(),
            'unbilled' => round(collect($this->unbilled())->sum('amount'), 2),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(Invoice $invoice, bool $withLines = false): array
    {
        $data = [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'client_name' => $invoice->client_name,
            'bill_to' => $invoice->bill_to,
            'status' => $invoice->status->value,
            'overdue' => $invoice->isOverdue(),
            'issue_date' => $invoice->issue_date->toDateString(),
            'due_date' => $invoice->due_date->toDateString(),
            'period_start' => $invoice->period_start?->toDateString(),
            'period_end' => $invoice->period_end?->toDateString(),
            'currency' => $invoice->currency,
            'subtotal' => (float) $invoice->subtotal,
            'tax_percent' => (float) $invoice->tax_percent,
            'tax_amount' => (float) $invoice->tax_amount,
            'discount' => (float) $invoice->discount,
            'total' => (float) $invoice->total,
            'amount_paid' => (float) $invoice->amount_paid,
            'balance' => $invoice->balance(),
            'notes' => $invoice->notes,
            'sent_at' => $invoice->sent_at?->toIso8601String(),
            'paid_at' => $invoice->paid_at?->toIso8601String(),
            'voided_at' => $invoice->voided_at?->toIso8601String(),
            'created_at' => $invoice->created_at?->toIso8601String(),
        ];

        if ($withLines) {
            $data['lines'] = $invoice->lines()->get()->map(fn (InvoiceLine $line) => [
                'id' => $line->id,
                'project_id' => $line->project_id,
                'kind' => $line->kind->value,
                'description' => $line->description,
                'quantity' => (float) $line->quantity,
                'unit_price' => (float) $line->unit_price,
                'amount' => (float) $line->amount,
            ])->all();
            $data['hours_billed'] = round(
                (int) TimeEntry::query()->where('invoice_id', $invoice->id)->sum('duration') / 3600,
                2,
            );
            $data['settings'] = $this->settings();
        }

        return $data;
    }

    /* ------------------------------------------------------------------ */
    /* Internals                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * @return Collection<int, Project>
     */
    private function billableProjects(): Collection
    {
        return Project::query()
            ->where('organization_id', TenantContext::id())
            ->whereIn('billing_type', [ProjectBillingType::Hourly, ProjectBillingType::Fixed])
            ->whereNotNull('client_name')
            ->where('client_name', '!=', '')
            ->orderBy('client_name')
            ->orderBy('name')
            ->get();
    }

    private function uninvoicedWork(Project $project, ?Carbon $from, Carbon $to): Builder
    {
        return TimeEntry::query()
            ->where('organization_id', TenantContext::id())
            ->where('project_id', $project->id)
            ->countable()
            ->whereIn('type', [TimeEntryType::Tracked, TimeEntryType::Manual])
            ->whereNull('invoice_id')
            ->when($from, fn (Builder $query) => $query->where('start_time', '>=', $from))
            ->where('start_time', '<=', $to);
    }

    /**
     * What one project would add to an invoice right now, or null if nothing.
     *
     * @return array<string, mixed>|null
     */
    private function projectLine(Project $project, ?Carbon $from, Carbon $to, bool $lock = false): ?array
    {
        if ($project->billingType() === ProjectBillingType::Hourly) {
            $rate = (float) ($project->hourly_rate ?? 0);
            $query = $this->uninvoicedWork($project, $from, $to);
            $entries = ($lock ? $query->lockForUpdate() : $query)->get(['id', 'duration', 'start_time']);
            $seconds = (int) $entries->sum('duration');

            if ($seconds <= 0 || $rate <= 0) {
                return null;
            }

            $hours = round($seconds / 3600, 2);

            return [
                'project_id' => $project->id,
                'kind' => InvoiceLineKind::Hourly,
                'description' => "{$project->name}: {$this->formatHours($hours)} at ".number_format($rate, 0).'/h',
                'quantity' => $hours,
                'unit_price' => $rate,
                'hours' => $hours,
                'amount' => round($hours * $rate, 2),
                'entry_ids' => $entries->pluck('id')->all(),
                'first_date' => $entries->min('start_time')?->toDateString(),
                'last_date' => $entries->max('start_time')?->toDateString(),
            ];
        }

        $fee = (float) ($project->budget_amount ?? 0);
        $billed = (float) InvoiceLine::query()
            ->where('project_id', $project->id)
            ->where('kind', InvoiceLineKind::Fixed)
            ->whereHas('invoice', fn (Builder $query) => $query->where('status', '!=', InvoiceStatus::Void))
            ->sum('amount');
        $remaining = round($fee - $billed, 2);

        if ($remaining <= 0) {
            return null;
        }

        return [
            'project_id' => $project->id,
            'kind' => InvoiceLineKind::Fixed,
            'description' => $billed > 0 ? "{$project->name}: remaining fixed fee" : "{$project->name}: fixed fee",
            'quantity' => 1,
            'unit_price' => $remaining,
            'hours' => 0.0,
            'amount' => $remaining,
            'entry_ids' => [],
            'first_date' => null,
            'last_date' => null,
        ];
    }

    private function recalculate(Invoice $invoice): Invoice
    {
        $subtotal = round((float) $invoice->lines()->sum('amount'), 2);
        $discount = min(round((float) $invoice->discount, 2), $subtotal);
        $taxAmount = round(($subtotal - $discount) * (float) $invoice->tax_percent / 100, 2);

        $invoice->update([
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax_amount' => $taxAmount,
            'total' => round($subtotal - $discount + $taxAmount, 2),
        ]);

        return $invoice->refresh();
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function takeNumber(Organization $organization, array $settings): string
    {
        $prefix = (string) $settings['number_prefix'];
        $next = max(1, (int) $settings['next_number']);

        // Skip numbers already used (for example after the prefix changed back).
        while (Invoice::query()->where('organization_id', $organization->id)
            ->where('number', $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT))->exists()) {
            $next++;
        }

        $organization->forceFill([
            'invoice_settings' => array_merge($organization->invoice_settings ?? [], ['next_number' => $next + 1]),
        ])->save();

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    private function assertDraft(Invoice $invoice, string $action): void
    {
        if ($invoice->status !== InvoiceStatus::Draft) {
            throw ValidationException::withMessages([
                'invoice' => ["Only draft invoices can be {$action}."],
            ]);
        }
    }

    private function formatHours(float $hours): string
    {
        return rtrim(rtrim(number_format($hours, 2, '.', ''), '0'), '.').'h';
    }
}
