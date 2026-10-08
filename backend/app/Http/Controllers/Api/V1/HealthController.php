<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

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
            'checks' => [
                'app_key_configured' => filled(config('app.key')),
                ...$this->databaseCheck(),
            ],
        ]);
    }

    /**
     * Reports connectivity and migration state without exposing connection details.
     *
     * @return array{database: string, database_error_code: string|null, migrated: bool}
     */
    private function databaseCheck(): array
    {
        try {
            DB::select('select 1');
        } catch (\Throwable $e) {
            return ['database' => 'error', 'database_error_code' => $this->errorCode($e), 'migrated' => false];
        }

        try {
            $migrated = DB::table('migrations')->exists();
        } catch (\Throwable) {
            $migrated = false;
        }

        return ['database' => 'ok', 'database_error_code' => null, 'migrated' => $migrated];
    }

    private function errorCode(\Throwable $e): string
    {
        $code = $e instanceof \PDOException || $e->getPrevious() instanceof \PDOException
            ? (string) $e->getCode()
            : '';

        return $code !== '' && $code !== '0' ? 'code '.$code : class_basename($e);
    }
}
