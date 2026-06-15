import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/api_client.dart';
import '../../core/models.dart';
import 'listings_provider.dart';

final _favoriteProvider = StateProvider.family<bool, String>((_, __) => false);

class ListingDetailScreen extends ConsumerWidget {
  final String categorySlug, listingSlug;
  const ListingDetailScreen({super.key, required this.categorySlug, required this.listingSlug});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider).languageCode;
    final listingAsync = ref.watch(listingDetailProvider((categorySlug, listingSlug)));

    return Scaffold(
      body: listingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (listing) => _ListingDetail(listing: listing, locale: locale, l: l),
      ),
    );
  }
}

class _ListingDetail extends ConsumerStatefulWidget {
  final Listing listing;
  final String locale;
  final AppLocalizations l;
  const _ListingDetail({required this.listing, required this.locale, required this.l});

  @override
  ConsumerState<_ListingDetail> createState() => _ListingDetailState();
}

class _ListingDetailState extends ConsumerState<_ListingDetail> {
  int _imageIndex = 0;

  Future<void> _toggleFavorite() async {
    final isFav = ref.read(_favoriteProvider(widget.listing.id));
    try {
      final api = ref.read(apiClientProvider);
      if (isFav) {
        await api.delete('/favorites/${widget.listing.id}', (_) => null);
      } else {
        await api.put('/favorites/${widget.listing.id}');
      }
      ref.read(_favoriteProvider(widget.listing.id).notifier).state = !isFav;
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please log in to save listings')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.l;
    final listing = widget.listing;
    final locale = widget.locale;
    final isFav = ref.watch(_favoriteProvider(listing.id));
    final media = listing.media;

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 280,
          pinned: true,
          actions: [
            IconButton(
              icon: Icon(isFav ? Icons.favorite : Icons.favorite_border, color: isFav ? Colors.red : null),
              onPressed: _toggleFavorite,
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: media.isEmpty
                ? Container(color: const Color(0xFFF3F4F6), child: const Icon(Icons.directions_car, size: 80, color: Color(0xFFD1D5DB)))
                : Stack(
                    children: [
                      PageView.builder(
                        itemCount: media.length,
                        onPageChanged: (i) => setState(() => _imageIndex = i),
                        itemBuilder: (_, i) => CachedNetworkImage(imageUrl: media[i].url, fit: BoxFit.cover),
                      ),
                      if (media.length > 1)
                        Positioned(
                          bottom: 12,
                          left: 0,
                          right: 0,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(media.length, (i) => Container(margin: const EdgeInsets.symmetric(horizontal: 3), width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: i == _imageIndex ? Colors.white : Colors.white.withOpacity(0.5)))),
                          ),
                        ),
                    ],
                  ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(listing.localTitle(locale), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (listing.averageRating != null) ...[
                      const Icon(Icons.star, size: 16, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 4),
                      Text('${listing.averageRating!.toStringAsFixed(1)} (${listing.reviewCount})', style: const TextStyle(color: Color(0xFF6B7280))),
                      const SizedBox(width: 16),
                    ],
                    if (listing.location != null) ...[
                      const Icon(Icons.location_on_outlined, size: 16, color: Color(0xFF6B7280)),
                      const SizedBox(width: 4),
                      Text(listing.location!.name, style: const TextStyle(color: Color(0xFF6B7280))),
                    ],
                  ],
                ),
                const SizedBox(height: 20),
                if (listing.prices.isNotEmpty) ...[
                  Text('Pricing', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 12,
                    children: listing.prices.map((p) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(8)),
                      child: Text('${p.currency} ${p.amount.toStringAsFixed(0)} / ${p.unit}', style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w700)),
                    )).toList(),
                  ),
                  const SizedBox(height: 20),
                ],
                if (listing.localDescription(locale) != null) ...[
                  Text('Description', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text(listing.localDescription(locale)!, style: const TextStyle(color: Color(0xFF374151), height: 1.6)),
                  const SizedBox(height: 20),
                ],
                if (listing.attributes.isNotEmpty) ...[
                  Text('Details', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: listing.attributes.entries.map((e) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(8)),
                      child: Text('${e.key}: ${e.value}', style: const TextStyle(fontSize: 12, color: Color(0xFF374151))),
                    )).toList(),
                  ),
                  const SizedBox(height: 20),
                ],
                if (listing.extras.isNotEmpty) ...[
                  Text('Extras', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  ...listing.extras.map((e) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        const Icon(Icons.add_circle_outline, size: 16, color: Color(0xFF2563EB)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(e.localName(locale))),
                        Text('+${e.price.toStringAsFixed(0)} / ${e.pricingUnit}', style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                      ],
                    ),
                  )),
                  const SizedBox(height: 20),
                ],
                const SizedBox(height: 80),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Sticky bottom book button ─────────────────────────────────────────────────

extension on _ListingDetail {
  // ignore: unused_element
  Widget buildBookButton(AppLocalizations l, Listing listing) => Positioned(
        bottom: 0, left: 0, right: 0,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE5E7EB)))),
          child: Row(
            children: [
              if (listing.dayPrice != null) ...[
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${listing.dayPrice!.currency} ${listing.dayPrice!.amount.toStringAsFixed(0)}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF2563EB))),
                    Text('per ${listing.dayPrice!.unit}', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
                  ],
                ),
                const SizedBox(width: 16),
              ],
              Expanded(
                child: ElevatedButton(
                  onPressed: () => context.push('/book/${listing.id}'),
                  child: Text(l.bookNow),
                ),
              ),
            ],
          ),
        ),
      );
}

// Wrap the detail in a Stack to show the book button
class ListingDetailScreenWrapper extends ConsumerWidget {
  final String categorySlug, listingSlug;
  const ListingDetailScreenWrapper({super.key, required this.categorySlug, required this.listingSlug});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider).languageCode;
    final listingAsync = ref.watch(listingDetailProvider((categorySlug, listingSlug)));

    return Scaffold(
      body: listingAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (listing) => Stack(
          children: [
            _ListingDetail(listing: listing, locale: locale, l: l),
            Positioned(
              bottom: 0, left: 0, right: 0,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE5E7EB)))),
                child: Row(
                  children: [
                    if (listing.dayPrice != null) ...[
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('${listing.dayPrice!.currency} ${listing.dayPrice!.amount.toStringAsFixed(0)}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF2563EB))),
                          Text('per ${listing.dayPrice!.unit}', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
                        ],
                      ),
                      const SizedBox(width: 16),
                    ],
                    Expanded(
                      child: ElevatedButton(onPressed: () => context.push('/book/${listing.id}'), child: Text(l.bookNow)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
