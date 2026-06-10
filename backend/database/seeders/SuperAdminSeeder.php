<?php

namespace Database\Seeders;

use App\Services\Auth\SuperAdminBootstrap;
use Illuminate\Database\Seeder;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        SuperAdminBootstrap::ensureExists();
    }
}
