<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class DisplayDate
{
    public const FORMAT = 'd/m/Y';

    public const INPUT_PATTERN = '/^\d{2}\/\d{2}\/\d{4}$/';

    public static function format(?Carbon $date): ?string
    {
        return $date?->format(self::FORMAT);
    }

    public static function parse(string $value, string $field = 'date'): Carbon
    {
        $value = trim($value);

        if (! preg_match(self::INPUT_PATTERN, $value)) {
            throw ValidationException::withMessages([
                $field => ['The date must be in dd/mm/yyyy format.'],
            ]);
        }

        $parsed = Carbon::createFromFormat('!'.self::FORMAT, $value);
        $errors = Carbon::getLastErrors();

        if ($parsed === false || ($errors['error_count'] ?? 0) > 0) {
            throw ValidationException::withMessages([
                $field => ['The date must be a valid dd/mm/yyyy date.'],
            ]);
        }

        return $parsed->startOfDay();
    }
}
