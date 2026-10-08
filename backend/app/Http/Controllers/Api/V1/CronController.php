<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

/**
 * Daily maintenance for hosts without a long-running scheduler (Vercel Cron).
 * Mirrors the daily Schedule entries in routes/console.php.
 */
class CronController extends Controller
{
    /** @var list<string> */
    private const DAILY_COMMANDS = [
        'idempotency:purge',
        'screenshots:purge-expired',
    ];

    public function daily(Request $request): JsonResponse
    {
        $secret = (string) config('services.cron.secret', '');

        if ($secret === '' || ! hash_equals('Bearer '.$secret, (string) $request->header('Authorization'))) {
            abort(401);
        }

        $results = [];

        foreach (self::DAILY_COMMANDS as $command) {
            $exitCode = Artisan::call($command);
            $results[$command] = $exitCode;

            Log::info('Cron command finished.', [
                'command' => $command,
                'exit_code' => $exitCode,
                'output' => trim(Artisan::output()),
            ]);
        }

        $failed = array_filter($results, fn (int $code) => $code !== 0);

        return response()->json(['commands' => $results], $failed === [] ? 200 : 500);
    }
}
