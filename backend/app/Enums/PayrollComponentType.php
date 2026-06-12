<?php

namespace App\Enums;

enum PayrollComponentType: string
{
    case Deduction = 'deduction';
    case Increment = 'increment';
}
