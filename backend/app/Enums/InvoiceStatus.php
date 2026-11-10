<?php

namespace App\Enums;

/**
 * Draft: editable, not yet sent. Sent: waiting for payment (overdue once
 * past the due date). Paid: fully paid. Void: cancelled, hours released.
 */
enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Paid = 'paid';
    case Void = 'void';
}
