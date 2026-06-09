<?php

namespace App\Enums;

enum TimeEntryStatus: string
{
    case Running = 'running';
    case Stopped = 'stopped';
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
