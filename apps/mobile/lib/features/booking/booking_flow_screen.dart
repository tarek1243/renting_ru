import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../app.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import 'booking_provider.dart';

class BookingFlowScreen extends ConsumerStatefulWidget {
  final String listingId;
  const BookingFlowScreen({super.key, required this.listingId});
  @override
  ConsumerState<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends ConsumerState<BookingFlowScreen> {
  int _step = 0; // 0=dates, 1=extras, 2=review
  DateTime? _start, _end;
  final Set<String> _extraIds = {};
  bool _withDriver = false;
  String _coupon = '';
  String _paymentMethod = 'cash';
  bool _loading = false;
  String? _error;

  Listing? _listing;

  @override
  void initState() {
    super.initState();
    _loadListing();
  }

  Future<void> _loadListing() async {
    try {
      // We just need the extras and driver info, not full slug-based detail
      // The booking API only needs listingId, so we pass minimal info
      setState(() {});
    } catch (_) {}
  }

  Future<Quote?> _fetchQuote() async {
    if (_start == null || _end == null) return null;
    try {
      return await ref.read(apiClientProvider).post(
            '/listings/${widget.listingId}/quote',
            (d) => Quote.fromJson(d as Map<String, dynamic>),
            body: {
              'startAt': _start!.toUtc().toIso8601String(),
              'endAt': _end!.toUtc().toIso8601String(),
              'pricingUnit': 'day',
              'withDriver': _withDriver,
              'extraIds': _extraIds.toList(),
              if (_coupon.isNotEmpty) 'couponCode': _coupon,
              'currency': 'USD',
            },
          );
    } catch (e) {
      return null;
    }
  }

  Future<void> _createBooking() async {
    if (_start == null || _end == null) return;
    setState(() { _loading = true; _error = null; });
    try {
      final booking = await ref.read(apiClientProvider).post(
            '/bookings',
            (d) => Booking.fromJson(d as Map<String, dynamic>),
            body: {
              'listingId': widget.listingId,
              'startAt': _start!.toUtc().toIso8601String(),
              'endAt': _end!.toUtc().toIso8601String(),
              'pricingUnit': 'day',
              'withDriver': _withDriver,
              'extraIds': _extraIds.toList(),
              if (_coupon.isNotEmpty) 'couponCode': _coupon,
              'currency': 'USD',
              'paymentMethod': _paymentMethod,
            },
          );
      if (mounted) context.go('/booking-confirmation/${booking.id}');
    } on ApiError catch (e) {
      setState(() { _error = e.message; _loading = false; });
    } catch (_) {
      setState(() { _error = 'Something went wrong. Please try again.'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l.bookNow)),
      body: Column(
        children: [
          _StepIndicator(current: _step),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: [
                _DateStep(start: _start, end: _end, onChanged: (s, e) => setState(() { _start = s; _end = e; })),
                _ExtrasStep(extraIds: _extraIds, withDriver: _withDriver, coupon: _coupon, onExtrasChanged: (id, sel) => setState(() { sel ? _extraIds.add(id) : _extraIds.remove(id); }), onDriverChanged: (v) => setState(() => _withDriver = v), onCouponChanged: (v) => setState(() => _coupon = v)),
                _ReviewStep(listingId: widget.listingId, start: _start, end: _end, extraIds: _extraIds, withDriver: _withDriver, coupon: _coupon, paymentMethod: _paymentMethod, onPaymentChanged: (v) => setState(() => _paymentMethod = v), error: _error, fetchQuote: _fetchQuote),
              ][_step],
            ),
          ),
          _BottomBar(
            step: _step,
            canNext: _step == 0 ? (_start != null && _end != null) : true,
            loading: _loading,
            onBack: _step > 0 ? () => setState(() => _step--) : null,
            onNext: _step < 2 ? () => setState(() => _step++) : _createBooking,
            l: l,
          ),
        ],
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final int current;
  const _StepIndicator({required this.current});

  @override
  Widget build(BuildContext context) {
    const steps = ['Dates', 'Extras', 'Review'];
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
      child: Row(
        children: List.generate(steps.length, (i) {
          final active = i == current;
          final done = i < current;
          return Expanded(
            child: Row(
              children: [
                Container(
                  width: 28, height: 28,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: done || active ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB)),
                  child: Center(child: done ? const Icon(Icons.check, size: 14, color: Colors.white) : Text('${i + 1}', style: TextStyle(color: active ? Colors.white : const Color(0xFF9CA3AF), fontSize: 12, fontWeight: FontWeight.w600))),
                ),
                const SizedBox(width: 6),
                Text(steps[i], style: TextStyle(fontSize: 12, fontWeight: active ? FontWeight.w600 : FontWeight.normal, color: active ? const Color(0xFF111827) : const Color(0xFF6B7280))),
                if (i < steps.length - 1) Expanded(child: Container(height: 1, margin: const EdgeInsets.symmetric(horizontal: 6), color: done ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB))),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _DateStep extends StatefulWidget {
  final DateTime? start, end;
  final void Function(DateTime?, DateTime?) onChanged;
  const _DateStep({required this.start, required this.end, required this.onChanged});

  @override
  State<_DateStep> createState() => _DateStepState();
}

class _DateStepState extends State<_DateStep> {
  late DateTime _focusedDay;
  DateTime? _rangeStart, _rangeEnd;

  @override
  void initState() {
    super.initState();
    _focusedDay = widget.start ?? DateTime.now();
    _rangeStart = widget.start;
    _rangeEnd = widget.end;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Select dates', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 16),
        TableCalendar(
          firstDay: DateTime.now(),
          lastDay: DateTime.now().add(const Duration(days: 365)),
          focusedDay: _focusedDay,
          rangeStartDay: _rangeStart,
          rangeEndDay: _rangeEnd,
          rangeSelectionMode: RangeSelectionMode.enforced,
          calendarStyle: const CalendarStyle(
            rangeHighlightColor: Color(0xFFBFDBFE),
            rangeStartDecoration: BoxDecoration(color: Color(0xFF2563EB), shape: BoxShape.circle),
            rangeEndDecoration: BoxDecoration(color: Color(0xFF2563EB), shape: BoxShape.circle),
            todayDecoration: BoxDecoration(color: Color(0xFF93C5FD), shape: BoxShape.circle),
          ),
          onRangeSelected: (start, end, focused) {
            setState(() { _rangeStart = start; _rangeEnd = end; _focusedDay = focused; });
            widget.onChanged(start, end);
          },
          onPageChanged: (focused) => setState(() => _focusedDay = focused),
        ),
        if (_rangeStart != null && _rangeEnd != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(8)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(children: [const Text('Check-in', style: TextStyle(color: Color(0xFF6B7280), fontSize: 12)), Text('${_rangeStart!.day}/${_rangeStart!.month}/${_rangeStart!.year}', style: const TextStyle(fontWeight: FontWeight.w600))]),
                const Icon(Icons.arrow_forward, color: Color(0xFF2563EB)),
                Column(children: [const Text('Check-out', style: TextStyle(color: Color(0xFF6B7280), fontSize: 12)), Text('${_rangeEnd!.day}/${_rangeEnd!.month}/${_rangeEnd!.year}', style: const TextStyle(fontWeight: FontWeight.w600))]),
                Column(children: [const Text('Duration', style: TextStyle(color: Color(0xFF6B7280), fontSize: 12)), Text('${_rangeEnd!.difference(_rangeStart!).inDays} days', style: const TextStyle(fontWeight: FontWeight.w600))]),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _ExtrasStep extends StatelessWidget {
  final Set<String> extraIds;
  final bool withDriver;
  final String coupon;
  final void Function(String, bool) onExtrasChanged;
  final void Function(bool) onDriverChanged;
  final void Function(String) onCouponChanged;
  const _ExtrasStep({required this.extraIds, required this.withDriver, required this.coupon, required this.onExtrasChanged, required this.onDriverChanged, required this.onCouponChanged});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final couponCtrl = TextEditingController(text: coupon);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Extras & options', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 16),
        SwitchListTile(
          value: withDriver,
          onChanged: onDriverChanged,
          title: Text(l.withDriver),
          subtitle: const Text('A professional driver will be assigned'),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: const BorderSide(color: Color(0xFFE5E7EB))),
        ),
        const SizedBox(height: 20),
        const Text('Coupon code', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: couponCtrl,
                decoration: InputDecoration(hintText: l.couponCode, prefixIcon: const Icon(Icons.discount_outlined)),
                textCapitalization: TextCapitalization.characters,
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: () => onCouponChanged(couponCtrl.text.trim()),
              style: ElevatedButton.styleFrom(minimumSize: const Size(80, 50)),
              child: Text(l.apply_coupon),
            ),
          ],
        ),
      ],
    );
  }
}

class _ReviewStep extends StatefulWidget {
  final String listingId;
  final DateTime? start, end;
  final Set<String> extraIds;
  final bool withDriver;
  final String coupon, paymentMethod;
  final void Function(String) onPaymentChanged;
  final String? error;
  final Future<Quote?> Function() fetchQuote;
  const _ReviewStep({required this.listingId, required this.start, required this.end, required this.extraIds, required this.withDriver, required this.coupon, required this.paymentMethod, required this.onPaymentChanged, required this.error, required this.fetchQuote});

  @override
  State<_ReviewStep> createState() => _ReviewStepState();
}

class _ReviewStepState extends State<_ReviewStep> {
  Quote? _quote;
  bool _loadingQuote = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadingQuote = true);
    _quote = await widget.fetchQuote();
    if (mounted) setState(() => _loadingQuote = false);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Review & pay', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 16),
        if (widget.error != null)
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
            child: Text(widget.error!, style: const TextStyle(color: Color(0xFFDC2626))),
          ),
        if (_loadingQuote) const Center(child: CircularProgressIndicator())
        else if (_quote != null) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE5E7EB)), borderRadius: BorderRadius.circular(12)),
            child: Column(
              children: [
                ..._quote!.breakdown.map((line) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(line.label, style: const TextStyle(color: Color(0xFF374151))),
                      Text(line.amount >= 0 ? '+${_quote!.currency} ${line.amount.toStringAsFixed(2)}' : '−${_quote!.currency} ${(-line.amount).toStringAsFixed(2)}', style: TextStyle(fontWeight: FontWeight.w600, color: line.amount < 0 ? const Color(0xFF16A34A) : const Color(0xFF111827))),
                    ],
                  ),
                )),
                const Divider(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(l.total, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    Text('${_quote!.currency} ${_quote!.totalAmount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF2563EB))),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],
        const Text('Payment method', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ...[
          ('cash', 'Pay in cash', Icons.money_outlined),
          ('stripe', 'Pay with card', Icons.credit_card_outlined),
          ('regional', 'Regional payment', Icons.account_balance_outlined),
        ].map((m) => RadioListTile<String>(
          value: m.$1,
          groupValue: widget.paymentMethod,
          onChanged: (v) => widget.onPaymentChanged(v!),
          title: Text(m.$2),
          secondary: Icon(m.$3),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8), side: const BorderSide(color: Color(0xFFE5E7EB))),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        )),
      ],
    );
  }
}

class _BottomBar extends StatelessWidget {
  final int step;
  final bool canNext, loading;
  final VoidCallback? onBack, onNext;
  final AppLocalizations l;
  const _BottomBar({required this.step, required this.canNext, required this.loading, required this.onBack, required this.onNext, required this.l});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE5E7EB)))),
      child: Row(
        children: [
          if (onBack != null) ...[
            OutlinedButton(onPressed: onBack, style: OutlinedButton.styleFrom(minimumSize: const Size(100, 50)), child: const Text('Back')),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: ElevatedButton(
              onPressed: (canNext && !loading) ? onNext : null,
              child: loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(step < 2 ? 'Next' : l.confirmBooking),
            ),
          ),
        ],
      ),
    );
  }
}
