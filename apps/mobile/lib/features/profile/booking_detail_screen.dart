import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import '../booking/booking_provider.dart';

class BookingDetailScreen extends ConsumerStatefulWidget {
  final String bookingId;
  const BookingDetailScreen({super.key, required this.bookingId});
  @override
  ConsumerState<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends ConsumerState<BookingDetailScreen> {
  bool _cancelling = false;
  bool _reviewing = false;
  final _reviewCtrl = TextEditingController();
  int _rating = 5;

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel booking?'),
        content: const Text('This action cannot be undone.'),
        actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('No')), ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Yes, cancel'))],
      ),
    );
    if (confirmed != true) return;
    setState(() => _cancelling = true);
    try {
      await ref.read(apiClientProvider).patch('/bookings/${widget.bookingId}/cancel', (_) => null, body: {'reason': 'Customer request'});
      ref.invalidate(bookingDetailProvider(widget.bookingId));
      ref.invalidate(myBookingsProvider(null));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  Future<void> _submitReview() async {
    if (_reviewCtrl.text.trim().isEmpty) return;
    try {
      await ref.read(apiClientProvider).post('/bookings/${widget.bookingId}/review', (_) => null, body: {'rating': _rating, 'comment': _reviewCtrl.text.trim()});
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Review submitted — thank you!')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  void _showReviewSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Write a review', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) => IconButton(icon: Icon(i < _rating ? Icons.star : Icons.star_border, color: const Color(0xFFF59E0B), size: 32), onPressed: () => setState(() => _rating = i + 1))),
            ),
            const SizedBox(height: 12),
            TextField(controller: _reviewCtrl, maxLines: 4, decoration: const InputDecoration(hintText: 'Share your experience...')),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _submitReview, child: const Text('Submit review')),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final bookingAsync = ref.watch(bookingDetailProvider(widget.bookingId));

    return Scaffold(
      appBar: AppBar(title: const Text('Booking detail')),
      body: bookingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (booking) => SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StatusBanner(booking: booking),
              const SizedBox(height: 20),
              _Section(title: 'Booking info', children: [
                _Row('Code', booking.code),
                _Row('Start', '${booking.startAt.day}/${booking.startAt.month}/${booking.startAt.year}'),
                _Row('End', '${booking.endAt.day}/${booking.endAt.month}/${booking.endAt.year}'),
                _Row('Total', '${booking.currency} ${booking.totalAmount.toStringAsFixed(2)}'),
                if (booking.payment != null) _Row('Payment', booking.payment!.status),
                if (booking.notes != null && booking.notes!.isNotEmpty) _Row('Notes', booking.notes!),
              ]),
              const SizedBox(height: 24),
              if (booking.canCancel) ...[
                OutlinedButton(
                  onPressed: _cancelling ? null : _cancel,
                  style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 50), foregroundColor: const Color(0xFFDC2626), side: const BorderSide(color: Color(0xFFDC2626))),
                  child: _cancelling ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l.cancel),
                ),
                const SizedBox(height: 12),
              ],
              if (booking.canReview)
                ElevatedButton(
                  onPressed: _showReviewSheet,
                  child: Text(l.writeReview),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  final Booking booking;
  const _StatusBanner({required this.booking});

  Color get _bg {
    switch (booking.status) {
      case 'confirmed': return const Color(0xFFDCFCE7);
      case 'in_progress': return const Color(0xFFEFF6FF);
      case 'completed': return const Color(0xFFF3F4F6);
      case 'cancelled': return const Color(0xFFFEF2F2);
      default: return const Color(0xFFFEF9C3);
    }
  }

  Color get _fg {
    switch (booking.status) {
      case 'confirmed': return const Color(0xFF15803D);
      case 'in_progress': return const Color(0xFF1D4ED8);
      case 'completed': return const Color(0xFF374151);
      case 'cancelled': return const Color(0xFFDC2626);
      default: return const Color(0xFFB45309);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(10)),
      child: Text(booking.statusLabel, style: TextStyle(color: _fg, fontWeight: FontWeight.w700, fontSize: 15), textAlign: TextAlign.center),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE5E7EB))),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  final String label, value;
  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6B7280))),
          Flexible(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600), textAlign: TextAlign.end)),
        ],
      ),
    );
  }
}
