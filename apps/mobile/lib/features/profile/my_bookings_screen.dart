import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/models.dart';
import '../booking/booking_provider.dart';

final _statusFilter = StateProvider<String?>((_) => null);

class MyBookingsScreen extends ConsumerWidget {
  const MyBookingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final status = ref.watch(_statusFilter);
    final bookingsAsync = ref.watch(myBookingsProvider(status));

    const statuses = ['All', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

    return Scaffold(
      appBar: AppBar(title: Text(l.myBookings)),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              itemCount: statuses.length,
              itemBuilder: (_, i) {
                final s = statuses[i];
                final selected = (s == 'All' && status == null) || s == status;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    selected: selected,
                    label: Text(s == 'All' ? 'All' : s.replaceAll('_', ' ')),
                    onSelected: (_) => ref.read(_statusFilter.notifier).state = s == 'All' ? null : s,
                    selectedColor: const Color(0xFF2563EB),
                    checkmarkColor: Colors.white,
                    labelStyle: TextStyle(color: selected ? Colors.white : null, fontSize: 13),
                  ),
                );
              },
            ),
          ),
          Expanded(
            child: bookingsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text(e.toString())),
              data: (bookings) {
                if (bookings.isEmpty) {
                  return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.calendar_month_outlined, size: 64, color: Color(0xFFD1D5DB)), const SizedBox(height: 16), Text(l.noBookings)]));
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(myBookingsProvider(status)),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: bookings.length,
                    itemBuilder: (_, i) => _BookingCard(booking: bookings[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  final Booking booking;
  const _BookingCard({required this.booking});

  Color get _statusColor {
    switch (booking.status) {
      case 'confirmed': return const Color(0xFF16A34A);
      case 'in_progress': return const Color(0xFF2563EB);
      case 'completed': return const Color(0xFF6B7280);
      case 'cancelled': return const Color(0xFFDC2626);
      case 'refunded': return const Color(0xFF7C3AED);
      default: return const Color(0xFFD97706);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => context.push('/bookings/${booking.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(booking.code, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: _statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                    child: Text(booking.statusLabel, style: TextStyle(color: _statusColor, fontSize: 12, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF6B7280)),
                  const SizedBox(width: 6),
                  Text('${booking.startAt.day}/${booking.startAt.month} → ${booking.endAt.day}/${booking.endAt.month}/${booking.endAt.year}', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
                  const Spacer(),
                  Text('${booking.currency} ${booking.totalAmount.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF2563EB))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
