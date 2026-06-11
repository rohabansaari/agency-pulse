<?php

namespace Tests\Concerns;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

trait ConnectsDesktopAgent
{
    protected function connectDesktopAgent(User $user): void
    {
        Cache::put(
            "screenshot_agent_heartbeat:{$user->organization_id}:{$user->id}",
            now()->toIso8601String(),
            now()->addDay()
        );
    }
}
