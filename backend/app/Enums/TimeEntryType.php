<?php

namespace App\Enums;

enum TimeEntryType: string
{
    case Tracked = 'tracked';
    case Manual = 'manual';
    case Leave = 'leave';
}
