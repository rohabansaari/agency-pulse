<?php

namespace App\Enums;

enum LeaveCategory: string
{
    case Medical = 'medical';
    case Casual = 'casual';
    case Annual = 'annual';

    public function label(): string
    {
        return match ($this) {
            self::Medical => 'Medical Leave',
            self::Casual => 'Casual Leave',
            self::Annual => 'Annual Leave',
        };
    }
}
