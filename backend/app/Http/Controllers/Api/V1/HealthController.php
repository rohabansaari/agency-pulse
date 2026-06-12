<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function show(): JsonResponse
    {
        $screenshotDisk = (string) config('screenshots.disk', 'public');

        return response()->json([
            'status' => 'ok',
            'service' => 'AgencyPulse API',
            'timestamp' => now()->toIso8601String(),
            'screenshot_disk' => $screenshotDisk,
            'screenshot_s3_configured' => $screenshotDisk === 's3'
                && filled(config('filesystems.disks.s3.bucket'))
                && filled(config('filesystems.disks.s3.endpoint')),
        ]);
    }
}
