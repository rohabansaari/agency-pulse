<?php

namespace App\Enums;

/**
 * How a project earns revenue.
 *
 * - Hourly: approved hours × the project's hourly (bill) rate.
 * - Fixed: a fixed fee (budget_amount), recognised as work is logged.
 * - NonBillable: internal work; it costs money but earns none.
 */
enum ProjectBillingType: string
{
    case Hourly = 'hourly';
    case Fixed = 'fixed';
    case NonBillable = 'non_billable';
}
