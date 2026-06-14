<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Welcome to AgencyPulse</title>
</head>
<body style="margin:0;padding:0;background:#f3f1ec;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a1917;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ec;padding:32px 16px;">
    <tr>
        <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#faf9f6;border:1px solid #ddd8cf;border-radius:12px;overflow:hidden;">
                <tr>
                    <td style="padding:28px 32px 8px;">
                        <div style="display:inline-block;background:#4a5568;color:#fff;font-weight:700;font-size:12px;padding:8px 10px;border-radius:8px;">AP</div>
                        <span style="margin-left:10px;font-weight:700;font-size:16px;">AgencyPulse</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 32px 32px;">
                        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;">Welcome, {{ $user->name }}</h1>
                        <p style="margin:0 0 16px;line-height:1.6;color:#6b6560;">
                            Your organization <strong style="color:#1a1917;">{{ $organization->name }}</strong> is ready on AgencyPulse.
                            Set your admin password to activate your account.
                        </p>
                        <p style="margin:0 0 24px;">
                            <a href="{{ $setupUrl }}" style="display:inline-block;background:#2d6a4f;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Set your password</a>
                        </p>
                        <p style="margin:0 0 8px;font-size:13px;color:#6b6560;line-height:1.5;">
                            This link expires in 24 hours and can only be used once.
                        </p>
                        <p style="margin:0;font-size:12px;color:#6b6560;line-height:1.5;word-break:break-all;">
                            If the button does not work, copy this URL:<br>{{ $setupUrl }}
                        </p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
