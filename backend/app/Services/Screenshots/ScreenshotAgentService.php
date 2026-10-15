<?php

namespace App\Services\Screenshots;

use App\Models\Screenshot;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class ScreenshotAgentService
{
    public function recordHeartbeat(User $user): void
    {
        Cache::put(
            $this->cacheKey($user->id, TenantContext::id()),
            now()->toIso8601String(),
            now()->addDay()
        );
    }

    /**
     * @return array{connected: bool, last_heartbeat_at: string|null, last_upload_at: string|null}
     */
    public function status(User $user): array
    {
        $organizationId = TenantContext::id();
        $lastHeartbeat = Cache::get($this->cacheKey($user->id, $organizationId));
        $lastUpload = Screenshot::query()
            ->where('user_id', $user->id)
            ->max('captured_at');

        $heartbeatThreshold = (int) config('screenshots.agent_heartbeat_threshold_minutes', 10);
        $uploadThreshold = (int) config('screenshots.agent_upload_threshold_minutes', 60);

        $heartbeatConnected = is_string($lastHeartbeat)
            && Carbon::parse($lastHeartbeat)->greaterThan(now()->subMinutes($heartbeatThreshold));

        $uploadConnected = $lastUpload !== null
            && Carbon::parse($lastUpload)->greaterThan(now()->subMinutes($uploadThreshold));

        return [
            'connected' => $heartbeatConnected || $uploadConnected,
            'last_heartbeat_at' => is_string($lastHeartbeat) ? $lastHeartbeat : null,
            'last_upload_at' => $lastUpload ? Carbon::parse($lastUpload)->toIso8601String() : null,
        ];
    }

    /**
     * Last time the agent itself checked in (heartbeat or screenshot upload), or null.
     * Unlike status(), recent uploads alone don't count as "connected": this is
     * what running timers are held to.
     */
    public function lastCheckInAt(int $userId, int $organizationId): ?Carbon
    {
        $lastHeartbeat = Cache::get($this->cacheKey($userId, $organizationId));

        return is_string($lastHeartbeat) ? Carbon::parse($lastHeartbeat) : null;
    }

    private function cacheKey(int $userId, int $organizationId): string
    {
        return "screenshot_agent_heartbeat:{$organizationId}:{$userId}";
    }
}
