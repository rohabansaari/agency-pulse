<?php

namespace App\Console\Commands;

use App\Services\Demo\DemoAgencySeeder;
use Illuminate\Console\Command;

class RemoveDemoAgencyCommand extends Command
{
    protected $signature = 'demo:remove';

    protected $description = 'Delete the Northwind Creative demo agency and everything in it';

    public function handle(DemoAgencySeeder $seeder): int
    {
        $removed = $seeder->remove();

        $this->info($removed === 0 && ! $seeder->exists()
            ? 'Demo agency removed (or it did not exist).'
            : "Demo agency removed with {$removed} users.");

        return self::SUCCESS;
    }
}
