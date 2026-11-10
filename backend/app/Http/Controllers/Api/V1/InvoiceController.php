<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\InvoiceStatus;
use App\Enums\UserRole;
use App\Models\Invoice;
use App\Services\Invoicing\InvoiceService;
use App\Support\DisplayDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Admin-only client invoicing. Dates in requests use dd/mm/yyyy like the rest
 * of the app; responses use ISO dates (YYYY-MM-DD).
 */
class InvoiceController extends TenantAppController
{
    public function __construct(
        private readonly InvoiceService $invoices,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $status = $request->query('status');
        $client = $request->query('client');
        $today = Carbon::today();

        $invoices = Invoice::query()
            ->when(is_string($client) && $client !== '', fn ($query) => $query->where('client_name', $client))
            ->when($status === 'overdue', fn ($query) => $query
                ->where('status', InvoiceStatus::Sent)
                ->whereDate('due_date', '<', $today))
            ->when(
                is_string($status) && InvoiceStatus::tryFrom($status) !== null,
                fn ($query) => $query->where('status', $status),
            )
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        return response()->json([
            'summary' => $this->invoices->summary(),
            'invoices' => $invoices->map(fn (Invoice $invoice) => $this->invoices->serialize($invoice))->values(),
            'clients' => Invoice::query()->distinct()->orderBy('client_name')->pluck('client_name'),
        ]);
    }

    public function unbilled(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json(['clients' => $this->invoices->unbilled()]);
    }

    public function settings(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json($this->invoices->settings());
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'business_name' => ['nullable', 'string', 'max:160'],
            'address' => ['nullable', 'string', 'max:1000'],
            'tax_id' => ['nullable', 'string', 'max:80'],
            'payment_details' => ['nullable', 'string', 'max:1000'],
            'default_due_days' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'default_tax_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'number_prefix' => ['sometimes', 'string', 'max:12', 'regex:/^[A-Za-z0-9\-\/]*$/'],
            'next_number' => ['sometimes', 'integer', 'min:1', 'max:999999'],
        ]);

        foreach (['address', 'tax_id', 'payment_details'] as $key) {
            if (array_key_exists($key, $data)) {
                $data[$key] = (string) ($data[$key] ?? '');
            }
        }

        return response()->json($this->invoices->updateSettings($data));
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'client_name' => ['required', 'string', 'max:255'],
            'start_date' => ['nullable', 'string'],
            'end_date' => ['nullable', 'string'],
        ]);

        $start = isset($data['start_date']) && $data['start_date'] !== ''
            ? DisplayDate::parse($data['start_date'], 'start_date')->startOfDay()
            : null;
        $end = isset($data['end_date']) && $data['end_date'] !== ''
            ? DisplayDate::parse($data['end_date'], 'end_date')->endOfDay()
            : Carbon::now();

        if ($start !== null && $end->lt($start)) {
            abort(422, 'End date must be on or after start date.');
        }

        $invoice = $this->invoices->createFromWork($data['client_name'], $start, $end, $request->user());

        return response()->json($this->invoices->serialize($invoice, true), 201);
    }

    public function show(Request $request, int $invoice): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json($this->invoices->serialize($this->find($invoice), true));
    }

    public function update(Request $request, int $invoice): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'client_name' => ['sometimes', 'string', 'max:255'],
            'bill_to' => ['nullable', 'string', 'max:1000'],
            'issue_date' => ['sometimes', 'string'],
            'due_date' => ['sometimes', 'string'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'tax_percent' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'discount' => ['sometimes', 'numeric', 'min:0'],
            'lines' => ['sometimes', 'array', 'max:100'],
            'lines.*.id' => ['nullable', 'integer'],
            'lines.*.description' => ['required', 'string', 'max:255'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0', 'max:100000'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0', 'max:1000000000'],
        ]);

        foreach (['issue_date', 'due_date'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = DisplayDate::parse($data[$field], $field)->toDateString();
            }
        }

        if (isset($data['issue_date'], $data['due_date']) && $data['due_date'] < $data['issue_date']) {
            abort(422, 'The due date must be on or after the issue date.');
        }

        $updated = $this->invoices->update($this->find($invoice), $data);

        return response()->json($this->invoices->serialize($updated, true));
    }

    public function send(Request $request, int $invoice): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json($this->invoices->serialize($this->invoices->markSent($this->find($invoice)), true));
    }

    public function pay(Request $request, int $invoice): JsonResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'paid_on' => ['nullable', 'string'],
        ]);

        $paidOn = isset($data['paid_on']) && $data['paid_on'] !== ''
            ? DisplayDate::parse($data['paid_on'], 'paid_on')
            : Carbon::now();

        $updated = $this->invoices->recordPayment($this->find($invoice), (float) $data['amount'], $paidOn);

        return response()->json($this->invoices->serialize($updated, true));
    }

    public function void(Request $request, int $invoice): JsonResponse
    {
        $this->authorizeAdmin($request);

        return response()->json($this->invoices->serialize($this->invoices->void($this->find($invoice)), true));
    }

    public function destroy(Request $request, int $invoice): JsonResponse
    {
        $this->authorizeAdmin($request);

        $this->invoices->delete($this->find($invoice));

        return response()->json(['message' => 'Draft invoice deleted. Its hours are unbilled again.']);
    }

    private function find(int $id): Invoice
    {
        // The tenant scope on Invoice limits this to the current organization.
        return Invoice::query()->findOrFail($id);
    }

    private function authorizeAdmin(Request $request): void
    {
        if ($request->user()?->currentRole() !== UserRole::Admin) {
            abort(403);
        }
    }
}
