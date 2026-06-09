<?php

namespace App\Enums;

enum PayrollDeductionMode: string
{
    case Percentage = 'percentage';

    /** Reserved for future Pakistan FBR progressive tax slabs. */
    case FbrSlabs = 'fbr_slabs';
}
