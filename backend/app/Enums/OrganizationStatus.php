<?php

namespace App\Enums;

enum OrganizationStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    case Trial = 'trial';

    /** Self sign-up waiting for a platform admin: can look around, can't change anything. */
    case Pending = 'pending';
}
