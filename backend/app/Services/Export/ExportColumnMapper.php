<?php

namespace App\Services\Export;

final class ExportColumnMapper
{
    /**
     * @return list<array{key: string, label: string}>
     */
    public static function employeeColumns(): array
    {
        return [
            ['key' => 'name', 'label' => 'Name'],
            ['key' => 'email', 'label' => 'Email'],
            ['key' => 'role', 'label' => 'Role'],
            ['key' => 'team', 'label' => 'Team'],
            ['key' => 'manager', 'label' => 'Manager'],
            ['key' => 'status', 'label' => 'Status'],
            ['key' => 'join_date', 'label' => 'Join Date'],
            ['key' => 'last_activity', 'label' => 'Last Activity'],
        ];
    }

    /**
     * @param  list<array{key: string, label: string}>  $columns
     * @param  list<array<string, mixed>>  $rows
     * @return list<list<string>>
     */
    public static function toMatrix(array $columns, array $rows): array
    {
        $header = array_map(fn (array $column) => $column['label'], $columns);
        $body = array_map(function (array $row) use ($columns): array {
            return array_map(
                fn (array $column) => self::cellValue($row[$column['key']] ?? null),
                $columns
            );
        }, $rows);

        return array_merge([$header], $body);
    }

    private static function cellValue(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        return (string) $value;
    }
}
