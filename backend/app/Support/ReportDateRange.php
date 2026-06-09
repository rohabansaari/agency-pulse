<?php

namespace App\Support;

use App\Services\Reporting\UtilizationCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class ReportDateRange
{
    /**
     * @return array{0: Carbon, 1: Carbon, start_date: string, end_date: string}
     */
    public static function fromRequest(Request $request, string $defaultPeriod = 'week'): array
    {
        $start = $request->query('start_date');
        $end = $request->query('end_date');

        if ($start || $end) {
            if (! is_string($start) || ! is_string($end) || $start === '' || $end === '') {
                throw ValidationException::withMessages([
                    'start_date' => ['Both start_date and end_date are required for a custom range.'],
                ]);
            }

            $startCarbon = DisplayDate::parse($start, 'start_date')->startOfDay();
            $endCarbon = DisplayDate::parse($end, 'end_date')->endOfDay();

            if ($endCarbon->lt($startCarbon)) {
                throw ValidationException::withMessages([
                    'end_date' => ['End date must be on or after start date.'],
                ]);
            }

            return [$startCarbon, $endCarbon, $start, $end];
        }

        /** @var UtilizationCalculator $calculator */
        $calculator = app(UtilizationCalculator::class);
        [$startCarbon, $endCarbon] = $calculator->periodBounds($defaultPeriod);

        return [
            $startCarbon,
            $endCarbon,
            DisplayDate::format($startCarbon) ?? '',
            DisplayDate::format($endCarbon) ?? '',
        ];
    }

    /**
     * @return array{start_date: string, end_date: string}
     */
    public static function meta(Carbon $start, Carbon $end): array
    {
        return [
            'start_date' => DisplayDate::format($start) ?? '',
            'end_date' => DisplayDate::format($end) ?? '',
        ];
    }
}
