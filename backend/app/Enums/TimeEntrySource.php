<?php

namespace App\Enums;

enum TimeEntrySource: string
{
    case Employee = 'employee';
    case Manager = 'manager';
    case Admin = 'admin';
}
