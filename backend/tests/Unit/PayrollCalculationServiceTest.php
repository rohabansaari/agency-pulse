<?php



namespace Tests\Unit;



use App\Enums\SalaryType;

use App\Models\EmployeeSalaryContract;

use App\Models\Organization;

use App\Models\OrganizationPayrollSettings;

use App\Models\User;

use App\Services\Payroll\PayrollCalculationService;

use App\Services\Payroll\PayrollSettingsService;

use App\Services\Tenant\TenantContext;

use Database\Seeders\RolePermissionSeeder;

use Illuminate\Foundation\Testing\RefreshDatabase;

use Illuminate\Support\Carbon;

use Tests\TestCase;



class PayrollCalculationServiceTest extends TestCase

{

    use RefreshDatabase;



    private PayrollCalculationService $calculator;



    private OrganizationPayrollSettings $settings;



    protected function setUp(): void

    {

        parent::setUp();

        $this->seed(RolePermissionSeeder::class);

        $this->calculator = app(PayrollCalculationService::class);

    }



    public function test_hourly_contract_pays_rate_times_hours(): void

    {

        $contract = $this->makeContract(SalaryType::Hourly, hourlyRate: '50');



        $pay = $this->calculator->entryPay(3600, $contract, $this->settings);



        $this->assertSame(50.0, $pay);

        $this->assertSame(50.0, $this->calculator->effectiveHourlyRate($contract, $this->settings));

    }



    public function test_monthly_contract_converts_to_hourly_base_before_multiplying_hours(): void

    {

        $contract = $this->makeContract(SalaryType::Monthly, monthlySalary: '100000');



        $expectedRate = 100000 / $this->settings->expectedMonthlyHours();

        $this->assertEqualsWithDelta($expectedRate, $this->calculator->effectiveHourlyRate($contract, $this->settings), 0.0001);



        $pay = $this->calculator->entryPay(4500, $contract, $this->settings);



        $this->assertEqualsWithDelta(710.23, $pay, 0.01);

    }



    public function test_monthly_contract_does_not_apply_full_monthly_salary_per_entry(): void

    {

        $contract = $this->makeContract(SalaryType::Monthly, monthlySalary: '100000');



        $pay = $this->calculator->entryPay(4500, $contract, $this->settings);



        $this->assertLessThan(1000, $pay);

        $this->assertNotEquals(100000.0, $pay);

        $this->assertNotEquals(250000.0, $pay);

    }



    public function test_expected_monthly_hours_follows_organization_settings(): void

    {

        $contract = $this->makeContract(SalaryType::Monthly, monthlySalary: '88000');

        $this->settings->update([

            'working_days_per_month' => 20,

            'working_hours_per_day' => 10,

        ]);



        $expectedRate = 88000 / 200;

        $this->assertEqualsWithDelta($expectedRate, $this->calculator->effectiveHourlyRate($contract, $this->settings->fresh()), 0.0001);

    }



    private function makeContract(

        SalaryType $type,

        ?string $hourlyRate = null,

        ?string $monthlySalary = null

    ): EmployeeSalaryContract {

        $organization = Organization::factory()->create();

        $user = User::factory()->create(['organization_id' => $organization->id]);

        TenantContext::set($organization);

        $this->settings = app(PayrollSettingsService::class)->forOrganization($organization->id);



        return EmployeeSalaryContract::create([

            'organization_id' => $organization->id,

            'user_id' => $user->id,

            'salary_type' => $type,

            'hourly_rate' => $hourlyRate,

            'monthly_salary' => $monthlySalary,

            'effective_from' => Carbon::today()->subMonth(),

            'is_active' => true,

        ]);

    }

}

