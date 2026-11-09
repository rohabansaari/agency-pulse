<?php

namespace App\Console\Commands;

use App\Services\Demo\DemoAgencySeeder;
use Illuminate\Console\Command;
use InvalidArgumentException;

/**
 * Creates or removes the "Northwind Creative" demo agency.
 *
 *   php artisan demo:seed     # reads DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_PAYROLL_PIN
 *   php artisan demo:seed --if-missing   # no-op when it already exists (used on boot)
 *   php artisan demo:remove
 */
class DemoAgencyCommand extends Command
{
    protected $signature = 'demo:seed
        {--if-missing : Do nothing if the demo agency already exists}
        {--fresh : Remove the existing demo agency first}';

    protected $description = 'Create the Northwind Creative demo agency with sample people, projects and work history';

    public function handle(DemoAgencySeeder $seeder): int
    {
        if ($seeder->exists()) {
            if ($this->option('if-missing')) {
                $this->info('Demo agency already exists; nothing to do.');

                return self::SUCCESS;
            }

            if (! $this->option('fresh')) {
                $this->error('The demo agency already exists. Use --fresh to rebuild it, or run demo:remove.');

                return self::FAILURE;
            }

            $seeder->remove();
        }

        $email = (string) config('demo.admin_email');
        $password = (string) config('demo.admin_password');
        $pin = (string) config('demo.payroll_pin');

        try {
            $result = $seeder->seed($email, $password, $pin);
        } catch (InvalidArgumentException $e) {
            $this->error('Demo agency not created: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf(
            'Demo agency created: %s (organization %d), sign in as %s. %d work entries.',
            $result['organization']->name,
            $result['organization']->id,
            $result['admin']->email,
            $result['entries'],
        ));

        return self::SUCCESS;
    }
}
