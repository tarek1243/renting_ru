import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app.dart';
import '../../core/models.dart';
import '../home/categories_provider.dart';
import 'listings_provider.dart';

class CategoryScreen extends ConsumerWidget {
  final String slug;
  const CategoryScreen({super.key, required this.slug});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context)!;
    final locale = ref.watch(localeProvider).languageCode;
    final categoriesAsync = ref.watch(categoriesProvider);
    final filter = ref.watch(listingFilterProvider(slug));
    final listingsAsync = ref.watch(listingsProvider((slug, filter)));

    final category = categoriesAsync.valueOrNull?.where((c) => c.slug == slug).firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(category?.localName(locale) ?? slug),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_outlined),
            onPressed: () => _showFilters(context, ref, category, locale),
          ),
        ],
      ),
      body: listingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [Text(e.toString()), TextButton(onPressed: () => ref.invalidate(listingsProvider((slug, filter))), child: Text(l.retry))],
          ),
        ),
        data: (result) {
          if (result.items.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.search_off, size: 64, color: Color(0xFFD1D5DB)), const SizedBox(height: 16), const Text('No listings found'), const SizedBox(height: 8), TextButton(onPressed: () => ref.read(listingFilterProvider(slug).notifier).state = const ListingFilter(), child: Text(l.reset))]));
          }
          return Column(
            children: [
              _ActiveFiltersBar(slug: slug, filter: filter),
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.73),
                  itemCount: result.items.length,
                  itemBuilder: (_, i) => _ListingCard(listing: result.items[i], locale: locale, categorySlug: slug),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showFilters(BuildContext context, WidgetRef ref, Category? category, String locale) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _FilterSheet(slug: slug, category: category, locale: locale, ref: ref),
    );
  }
}

class _ActiveFiltersBar extends ConsumerWidget {
  final String slug;
  final ListingFilter filter;
  const _ActiveFiltersBar({required this.slug, required this.filter});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasFilters = filter.startAt != null || filter.attrs.isNotEmpty;
    if (!hasFilters) return const SizedBox();
    return Container(
      color: const Color(0xFFF0F7FF),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.filter_alt, size: 16, color: Color(0xFF2563EB)),
          const SizedBox(width: 8),
          const Expanded(child: Text('Filters active', style: TextStyle(fontSize: 13, color: Color(0xFF2563EB)))),
          TextButton(
            onPressed: () => ref.read(listingFilterProvider(slug).notifier).state = const ListingFilter(),
            child: const Text('Clear', style: TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _ListingCard extends StatelessWidget {
  final Listing listing;
  final String locale, categorySlug;
  const _ListingCard({required this.listing, required this.locale, required this.categorySlug});

  @override
  Widget build(BuildContext context) {
    final price = listing.dayPrice;
    return GestureDetector(
      onTap: () => context.push('/category/$categorySlug/listing/${listing.slug}'),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: listing.primaryImageUrl != null
                  ? CachedNetworkImage(imageUrl: listing.primaryImageUrl!, fit: BoxFit.cover, width: double.infinity, placeholder: (_, __) => Container(color: const Color(0xFFF3F4F6)))
                  : Container(color: const Color(0xFFF3F4F6), child: const Icon(Icons.directions_car, color: Color(0xFFD1D5DB), size: 48)),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(listing.localTitle(locale), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  if (price != null) Text('${price.currency} ${price.amount.toStringAsFixed(0)} / ${price.unit}', style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w700, fontSize: 12)),
                  if (listing.averageRating != null) Row(children: [const Icon(Icons.star, size: 12, color: Color(0xFFF59E0B)), const SizedBox(width: 2), Text(listing.averageRating!.toStringAsFixed(1), style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)))]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  final String slug;
  final Category? category;
  final String locale;
  final WidgetRef ref;
  const _FilterSheet({required this.slug, required this.category, required this.locale, required this.ref});

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late Map<String, dynamic> _attrs;
  String _sortBy = 'createdAt';

  @override
  void initState() {
    super.initState();
    final current = widget.ref.read(listingFilterProvider(widget.slug));
    _attrs = Map.from(current.attrs);
    _sortBy = current.sortBy ?? 'createdAt';
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      expand: false,
      builder: (_, controller) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l.filters, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                TextButton(onPressed: () { setState(() { _attrs.clear(); _sortBy = 'createdAt'; }); }, child: Text(l.reset)),
              ],
            ),
            const Divider(),
            Expanded(
              child: ListView(
                controller: controller,
                children: [
                  Text(l.sortBy, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      ChoiceChip(label: Text(l.newest), selected: _sortBy == 'createdAt', onSelected: (_) => setState(() => _sortBy = 'createdAt')),
                      ChoiceChip(label: Text(l.price), selected: _sortBy == 'price', onSelected: (_) => setState(() => _sortBy = 'price')),
                      ChoiceChip(label: Text(l.rating), selected: _sortBy == 'rating', onSelected: (_) => setState(() => _sortBy = 'rating')),
                    ],
                  ),
                  if (widget.category != null) ...[
                    const SizedBox(height: 16),
                    ...widget.category!.attributes.where((a) => a.filterWidget == 'select' && a.options != null).map(
                          (attr) => Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(attr.localLabel(widget.locale), style: const TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                children: attr.options!.map(
                                  (opt) => ChoiceChip(
                                    label: Text(opt),
                                    selected: _attrs[attr.key] == opt,
                                    onSelected: (sel) => setState(() { if (sel) { _attrs[attr.key] = opt; } else { _attrs.remove(attr.key); } }),
                                  ),
                                ).toList(),
                              ),
                              const SizedBox(height: 12),
                            ],
                          ),
                        ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () {
                widget.ref.read(listingFilterProvider(widget.slug).notifier).state = ListingFilter(attrs: _attrs, sortBy: _sortBy);
                Navigator.pop(context);
              },
              child: Text(l.apply),
            ),
          ],
        ),
      ),
    );
  }
}
