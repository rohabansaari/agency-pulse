<?php

namespace Tests\Unit;

use App\Services\Export\ExportColumnMapper;
use PHPUnit\Framework\TestCase;

class ExportColumnMapperTest extends TestCase
{
    public function test_employee_export_columns_exclude_salary_fields(): void
    {
        $columns = ExportColumnMapper::employeeColumns();
        $keys = array_column($columns, 'key');

        $this->assertContains('name', $keys);
        $this->assertContains('email', $keys);
        $this->assertNotContains('salary', $keys);
        $this->assertNotContains('hourly_rate', $keys);
        $this->assertNotContains('gross_pay', $keys);
        $this->assertNotContains('net_pay', $keys);
    }

    public function test_csv_matrix_includes_header_row_first(): void
    {
        $columns = [
            ['key' => 'name', 'label' => 'Name'],
            ['key' => 'email', 'label' => 'Email'],
        ];
        $rows = [
            ['name' => 'Jane', 'email' => 'jane@example.com'],
        ];

        $matrix = ExportColumnMapper::toMatrix($columns, $rows);

        $this->assertSame(['Name', 'Email'], $matrix[0]);
        $this->assertSame(['Jane', 'jane@example.com'], $matrix[1]);
    }
}
