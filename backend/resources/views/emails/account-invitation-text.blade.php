@if ($isAdminWelcome)
Welcome, {{ $user->name }}

Your organization {{ $organization->name }} is ready on AgencyPulse.
Set your admin password to activate your account.
@else
Hi {{ $user->name }},

You have been invited to join {{ $organization->name }} on AgencyPulse.
Set your password to activate your account.
@endif

Set your password: {{ $setupUrl }}

This link expires in 24 hours and can only be used once.
