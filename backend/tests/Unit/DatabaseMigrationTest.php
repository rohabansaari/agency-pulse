<?php

namespace Tests\Unit;

use App\Support\DatabaseMigration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_column_is_nullable_on_sqlite_for_new_users_table(): void
    {
        $this->assertTrue(Schema::hasColumn('users', 'organization_id'));
        $this->assertTrue(DatabaseMigration::columnIsNullable('users', 'organization_id'));
    }

    public function test_driver_returns_sqlite_in_tests(): void
    {
        $this->assertSame('sqlite', DatabaseMigration::driver());
    }
}
