<?php

namespace App\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cross-database helpers for legacy migrations (MySQL → PostgreSQL parity).
 */
final class DatabaseMigration
{
    public static function driver(): string
    {
        return Schema::getConnection()->getDriverName();
    }

    public static function columnIsNullable(string $table, string $column): bool
    {
        return match (self::driver()) {
            'mysql' => self::mysqlColumnIsNullable($table, $column),
            'pgsql' => self::pgsqlColumnIsNullable($table, $column),
            'sqlite' => self::sqliteColumnIsNullable($table, $column),
            default => false,
        };
    }

    public static function setBigIntNotNull(string $table, string $column): void
    {
        match (self::driver()) {
            'mysql' => DB::statement("ALTER TABLE {$table} MODIFY {$column} BIGINT UNSIGNED NOT NULL"),
            'pgsql' => DB::statement("ALTER TABLE {$table} ALTER COLUMN {$column} SET NOT NULL"),
            default => Schema::table($table, function (Blueprint $blueprint) use ($column): void {
                $blueprint->unsignedBigInteger($column)->nullable(false)->change();
            }),
        };
    }

    public static function setBigIntNullable(string $table, string $column): void
    {
        match (self::driver()) {
            'mysql' => DB::statement("ALTER TABLE {$table} MODIFY {$column} BIGINT UNSIGNED NULL"),
            'pgsql' => DB::statement("ALTER TABLE {$table} ALTER COLUMN {$column} DROP NOT NULL"),
            default => Schema::table($table, function (Blueprint $blueprint) use ($column): void {
                $blueprint->unsignedBigInteger($column)->nullable()->change();
            }),
        };
    }

    public static function setStringNotNull(string $table, string $column, int $length = 255): void
    {
        match (self::driver()) {
            'mysql' => DB::statement("ALTER TABLE {$table} MODIFY {$column} VARCHAR({$length}) NOT NULL"),
            'pgsql' => DB::statement("ALTER TABLE {$table} ALTER COLUMN {$column} SET NOT NULL"),
            default => Schema::table($table, function (Blueprint $blueprint) use ($column): void {
                $blueprint->string($column)->nullable(false)->change();
            }),
        };
    }

    public static function makeOrganizationIdNullable(string $table = 'users'): void
    {
        Schema::table($table, function (Blueprint $blueprint): void {
            $blueprint->dropForeign(['organization_id']);
        });

        self::setBigIntNullable($table, 'organization_id');

        Schema::table($table, function (Blueprint $blueprint): void {
            $blueprint->foreign('organization_id')
                ->references('id')
                ->on('organizations')
                ->nullOnDelete();
        });
    }

    public static function makeOrganizationIdRequired(string $table = 'users'): void
    {
        Schema::table($table, function (Blueprint $blueprint): void {
            $blueprint->dropForeign(['organization_id']);
        });

        self::setBigIntNotNull($table, 'organization_id');

        Schema::table($table, function (Blueprint $blueprint): void {
            $blueprint->foreign('organization_id')
                ->references('id')
                ->on('organizations')
                ->cascadeOnDelete();
        });
    }

    private static function mysqlColumnIsNullable(string $table, string $column): bool
    {
        $result = DB::selectOne('
            SELECT IS_NULLABLE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
        ', [$table, $column]);

        return strtoupper((string) ($result->IS_NULLABLE ?? 'NO')) === 'YES';
    }

    private static function pgsqlColumnIsNullable(string $table, string $column): bool
    {
        $result = DB::selectOne('
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = ?
              AND column_name = ?
        ', [$table, $column]);

        return strtolower((string) ($result->is_nullable ?? 'no')) === 'yes';
    }

    private static function sqliteColumnIsNullable(string $table, string $column): bool
    {
        foreach (DB::select('PRAGMA table_info('.$table.')') as $info) {
            if (($info->name ?? null) === $column) {
                return (int) ($info->notnull ?? 1) === 0;
            }
        }

        return false;
    }
}
