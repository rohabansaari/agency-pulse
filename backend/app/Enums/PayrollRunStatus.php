<?php

namespace App\Enums;

enum PayrollRunStatus: string
{
    case Draft = 'draft';
    case Finalized = 'finalized';
    case Locked = 'locked';

    public function blocksTimeEntryEdits(): bool
    {
        return $this === self::Finalized || $this === self::Locked;
    }
}
