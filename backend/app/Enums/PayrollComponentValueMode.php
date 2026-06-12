<?php

namespace App\Enums;

enum PayrollComponentValueMode: string
{
    case Percentage = 'percentage';
    case Fixed = 'fixed';
}
