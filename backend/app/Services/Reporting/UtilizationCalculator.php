<?php



namespace App\Services\Reporting;



use Illuminate\Support\Carbon;



class UtilizationCalculator

{

    /** Standard 8-hour workday in seconds. */

    public const SECONDS_PER_WORK_DAY = 8 * 3600;



    public function weekdayCount(Carbon $start, Carbon $end): int

    {

        $count = 0;

        $cursor = $start->copy()->startOfDay();

        $endDay = $end->copy()->startOfDay();



        while ($cursor->lte($endDay)) {

            if ($cursor->isWeekday()) {

                $count++;

            }

            $cursor->addDay();

        }



        return max($count, 1);

    }



    public function expectedSeconds(int $employeeCount, Carbon $start, Carbon $end): int

    {

        if ($employeeCount <= 0) {

            return 0;

        }



        return $employeeCount * $this->weekdayCount($start, $end) * self::SECONDS_PER_WORK_DAY;

    }



    public function utilizationPercent(int $trackedSeconds, int $expectedSeconds): float

    {

        if ($expectedSeconds <= 0) {

            return 0.0;

        }



        return round(($trackedSeconds / $expectedSeconds) * 100, 1);

    }



    public function periodBounds(string $period): array

    {

        $now = Carbon::now();



        return match ($period) {

            'week' => [$now->copy()->startOfWeek(), $now->copy()->endOfDay()],

            'month' => [$now->copy()->startOfMonth(), $now->copy()->endOfDay()],

            default => [$now->copy()->startOfDay(), $now->copy()->endOfDay()],

        };

    }

}

