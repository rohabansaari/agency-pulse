<?php

namespace App\Services\Screenshots;

use App\Models\Screenshot;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Keyboard/mouse activity derived from the windows the desktop agent reports
 * with each screenshot: active seconds over observed seconds.
 */
class ActivityService
{
    public static function percent(?int $activeSeconds, ?int $windowSeconds): ?int
    {
        if ($activeSeconds === null || $windowSeconds === null || $windowSeconds <= 0) {
            return null;
        }

        return (int) round(min($activeSeconds, $windowSeconds) / $windowSeconds * 100);
    }

    /**
     * Activity % for a query of screenshots, or null when none carry activity data.
     */
    public function percentForQuery(Builder $screenshots): ?int
    {
        $totals = (clone $screenshots)
            ->reorder()
            ->whereNotNull('activity_window_seconds')
            ->selectRaw('COALESCE(SUM(active_seconds), 0) AS active, COALESCE(SUM(activity_window_seconds), 0) AS observed')
            ->toBase()
            ->first();

        return self::percent((int) ($totals->active ?? 0), (int) ($totals->observed ?? 0) ?: null);
    }

    /**
     * @param  list<int>  $userIds
     * @return array<int, int> user_id => activity %, only for users with activity data
     */
    public function percentByUser(int $organizationId, Carbon $start, Carbon $end, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return Screenshot::query()
            ->where('organization_id', $organizationId)
            ->whereIn('user_id', $userIds)
            ->whereBetween('captured_at', [$start, $end])
            ->whereNotNull('activity_window_seconds')
            ->groupBy('user_id')
            ->selectRaw('user_id, SUM(active_seconds) AS active, SUM(activity_window_seconds) AS observed')
            ->toBase()
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->user_id => self::percent((int) $row->active, (int) $row->observed)])
            ->filter(fn ($percent) => $percent !== null)
            ->all();
    }
}
