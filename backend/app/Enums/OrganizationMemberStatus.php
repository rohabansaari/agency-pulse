<?php

namespace App\Enums;

enum OrganizationMemberStatus: string
{
    case Active = 'active';
    case Invited = 'invited';
    case Suspended = 'suspended';
}
