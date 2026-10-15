<?php

return [
    'disk' => env('SCREENSHOT_DISK', env('FILESYSTEM_DISK', 'public')),
    'retention_days' => (int) env('SCREENSHOT_RETENTION_DAYS', 60),
    'max_upload_kb' => (int) env('SCREENSHOT_MAX_UPLOAD_KB', 5120),
    'rate_limit_per_minute' => (int) env('SCREENSHOT_RATE_LIMIT', 10),
    'agent_heartbeat_threshold_minutes' => (int) env('SCREENSHOT_AGENT_HEARTBEAT_THRESHOLD_MINUTES', 10),
    'agent_upload_threshold_minutes' => (int) env('SCREENSHOT_AGENT_UPLOAD_THRESHOLD_MINUTES', 60),
    // Timers can only start while the user's desktop agent is connected (recent heartbeat).
    // A running timer pauses once the agent has not checked in for this long.
    'timer_agent_offline_minutes' => (int) env('TIMER_AGENT_OFFLINE_MINUTES', 5),
    'timer_requires_agent' => (bool) env('TIMER_REQUIRES_DESKTOP_AGENT', true),
];
