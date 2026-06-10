<?php

namespace App\Console\Commands;

use App\Models\Screenshot;
use App\Services\Screenshots\ScreenshotStorageService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeExpiredScreenshots extends Command
{
    protected $signature = 'screenshots:purge-expired';

    protected $description = 'Delete screenshots older than the configured retention period';

    public function handle(ScreenshotStorageService $storage): int
    {
        $cutoff = now()->subDays((int) config('screenshots.retention_days', 60));
        $deleted = 0;

        Screenshot::query()
            ->withoutGlobalScopes()
            ->where('captured_at', '<', $cutoff)
            ->orderBy('id')
            ->chunkById(100, function ($screenshots) use ($storage, &$deleted): void {
                DB::transaction(function () use ($screenshots, $storage, &$deleted): void {
                    foreach ($screenshots as $screenshot) {
                        $storage->delete($screenshot);
                        $screenshot->delete();
                        $deleted++;
                    }
                });
            });

        $this->info("Purged {$deleted} expired screenshots captured before {$cutoff->toDateTimeString()}.");

        return self::SUCCESS;
    }
}
