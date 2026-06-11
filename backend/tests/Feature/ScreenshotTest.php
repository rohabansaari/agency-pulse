<?php

namespace Tests\Feature;

use App\Enums\TimeEntryStatus;
use App\Models\Screenshot;
use App\Models\TimeEntry;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ScreenshotTest extends TestCase
{
    use RefreshDatabase;

    private const SAMPLE_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIWFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAEFBgIHAf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAZ+P/wD/2Q==';

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        config(['screenshots.disk' => 'public']);
        Storage::fake('public');
    }

    private function tenantHeaders(User $user): array
    {
        return [
            'X-Organization-Id' => (string) $user->organization_id,
        ];
    }

    private function startRunningTimer(User $user): TimeEntry
    {
        return TimeEntry::query()->create([
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'start_time' => now(),
            'status' => TimeEntryStatus::Running,
        ]);
    }

    public function test_employee_can_upload_screenshot_with_active_timer(): void
    {
        $user = User::factory()->create();
        $this->startRunningTimer($user);
        Sanctum::actingAs($user);

        $sessionId = Str::uuid()->toString();

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/screenshots', [
                'image' => self::SAMPLE_IMAGE,
                'timestamp' => now()->toIso8601String(),
                'session_id' => $sessionId,
            ]);

        $response->assertCreated()
            ->assertJsonPath('screenshot.user_id', $user->id)
            ->assertJsonPath('screenshot.session_id', $sessionId);

        $this->assertDatabaseHas('screenshots', [
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'session_id' => $sessionId,
        ]);
    }

    public function test_upload_without_active_timer_returns_no_active_timer(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/screenshots', [
                'image' => self::SAMPLE_IMAGE,
                'timestamp' => now()->toIso8601String(),
                'session_id' => Str::uuid()->toString(),
            ]);

        $response->assertForbidden()
            ->assertJsonPath('code', 'NO_ACTIVE_TIMER');
    }

    public function test_manager_can_upload_screenshot_with_active_timer(): void
    {
        $manager = User::factory()->manager()->create();
        $this->startRunningTimer($manager);
        Sanctum::actingAs($manager);

        $response = $this->withHeaders($this->tenantHeaders($manager))
            ->postJson('/api/v1/screenshots', [
                'image' => self::SAMPLE_IMAGE,
                'timestamp' => now()->toIso8601String(),
                'session_id' => Str::uuid()->toString(),
            ]);

        $response->assertCreated()
            ->assertJsonPath('screenshot.user_id', $manager->id);
    }

    public function test_agent_heartbeat_marks_user_connected(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $heartbeat = $this->withHeaders($this->tenantHeaders($user))
            ->postJson('/api/v1/screenshots/agent-heartbeat');

        $heartbeat->assertOk();

        $status = $this->withHeaders($this->tenantHeaders($user))
            ->getJson('/api/v1/screenshots/agent-status');

        $status->assertOk()
            ->assertJsonPath('connected', true);
    }

    public function test_unauthenticated_upload_is_rejected(): void
    {
        $response = $this->postJson('/api/v1/screenshots', [
            'image' => self::SAMPLE_IMAGE,
            'timestamp' => now()->toIso8601String(),
            'session_id' => Str::uuid()->toString(),
        ]);

        $response->assertUnauthorized();
    }

    public function test_admin_can_list_org_screenshots(): void
    {
        $admin = User::factory()->admin()->create();
        $employee = User::factory()->create([
            'organization_id' => $admin->organization_id,
        ]);

        Screenshot::query()->create([
            'organization_id' => $employee->organization_id,
            'user_id' => $employee->id,
            'session_id' => Str::uuid()->toString(),
            'storage_disk' => 'public',
            'image_path' => 'org/1/screenshots/test.jpg',
            'file_size_bytes' => 100,
            'captured_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $response = $this->withHeaders($this->tenantHeaders($admin))
            ->getJson('/api/v1/screenshots');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user_id', $employee->id);
    }

    public function test_employee_can_list_own_screenshots(): void
    {
        $employee = User::factory()->create();

        Screenshot::query()->create([
            'organization_id' => $employee->organization_id,
            'user_id' => $employee->id,
            'session_id' => Str::uuid()->toString(),
            'storage_disk' => 'public',
            'image_path' => 'org/1/screenshots/mine.jpg',
            'file_size_bytes' => 100,
            'captured_at' => now(),
        ]);

        Sanctum::actingAs($employee);

        $response = $this->withHeaders($this->tenantHeaders($employee))
            ->getJson('/api/v1/screenshots');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user_id', $employee->id);
    }

    public function test_employee_cannot_list_other_users_screenshots(): void
    {
        $employee = User::factory()->create();
        $otherEmployee = User::factory()->create([
            'organization_id' => $employee->organization_id,
        ]);

        Screenshot::query()->create([
            'organization_id' => $otherEmployee->organization_id,
            'user_id' => $otherEmployee->id,
            'session_id' => Str::uuid()->toString(),
            'storage_disk' => 'public',
            'image_path' => 'org/1/screenshots/other.jpg',
            'file_size_bytes' => 100,
            'captured_at' => now(),
        ]);

        Sanctum::actingAs($employee);

        $response = $this->withHeaders($this->tenantHeaders($employee))
            ->getJson('/api/v1/screenshots');

        $response->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_expired_screenshots_are_purged(): void
    {
        $user = User::factory()->create();

        $expired = Screenshot::query()->create([
            'organization_id' => $user->organization_id,
            'user_id' => $user->id,
            'session_id' => Str::uuid()->toString(),
            'storage_disk' => 'public',
            'image_path' => 'org/1/screenshots/expired.jpg',
            'file_size_bytes' => 100,
            'captured_at' => now()->subDays(61),
        ]);

        Storage::disk('public')->put($expired->image_path, 'binary');

        $fresh = Screenshot::query()->create([
            'organization_id' => $user->organization_id,
            'user_id' => $user->id,
            'session_id' => Str::uuid()->toString(),
            'storage_disk' => 'public',
            'image_path' => 'org/1/screenshots/fresh.jpg',
            'file_size_bytes' => 100,
            'captured_at' => now(),
        ]);

        Storage::disk('public')->put($fresh->image_path, 'binary');

        Artisan::call('screenshots:purge-expired');

        $this->assertDatabaseMissing('screenshots', ['id' => $expired->id]);
        $this->assertDatabaseHas('screenshots', ['id' => $fresh->id]);
        Storage::disk('public')->assertMissing($expired->image_path);
        Storage::disk('public')->assertExists($fresh->image_path);
    }
}
