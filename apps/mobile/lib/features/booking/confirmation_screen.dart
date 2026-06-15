import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'booking_provider.dart';

class ConfirmationScreen extends ConsumerWidget {
  final String bookingId;
  const ConfirmationScreen({super.key, required this.bookingId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final bookingAsync = ref.watch(bookingDetailProvider(bookingId));

    return Scaffold(
      body: bookingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (booking) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle_outline, size: 80, color: Color(0xFF16A34A)),
                const SizedBox(height: 24),
                Text(l.bookingConfirmed, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(booking.statusLabel, style: const TextStyle(color: Color(0xFF6B7280))),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE5E7EB)), borderRadius: BorderRadius.circular(12)),
                  child: Column(
                    children: [
                      _Row(label: l.bookingCode, value: booking.code),
                      const SizedBox(height: 12),
                      _Row(label: 'Start', value: '${booking.startAt.day}/${booking.startAt.month}/${booking.startAt.year}'),
                      const SizedBox(height: 12),
                      _Row(label: 'End', value: '${booking.endAt.day}/${booking.endAt.month}/${booking.endAt.year}'),
                      const SizedBox(height: 12),
                      _Row(label: l.total, value: '${booking.currency} ${booking.totalAmount.toStringAsFixed(2)}', bold: true),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: () => context.go('/bookings/${booking.id}'),
                  child: const Text('View booking details'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => context.go('/home'),
                  child: const Text('Back to home'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label, value;
  final bool bold;
  const _Row({required this.label, required this.value, this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF6B7280))),
        Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: bold ? const Color(0xFF2563EB) : const Color(0xFF111827))),
      ],
    );
  }
}
