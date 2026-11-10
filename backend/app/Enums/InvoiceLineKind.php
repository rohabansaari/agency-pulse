<?php

namespace App\Enums;

/** Hourly: approved hours × rate. Fixed: (part of) a fixed fee. Custom: typed by hand. */
enum InvoiceLineKind: string
{
    case Hourly = 'hourly';
    case Fixed = 'fixed';
    case Custom = 'custom';
}
