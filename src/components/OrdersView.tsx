import React, { useState, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Check,
  RefreshCw,
  Package,
  Truck,
  Copy,
  Plus,
  Minus,
  Edit3,
  X,
  Phone,
  MapPin,
  Tag,
  Globe,
  Layers,
  Send,
  Loader2,
  Trash2,
  Calendar,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { updateOrderCardViaAppsScript, buildOrderCardPayload } from '../services/sheets';

export interface OrdersViewProps {
  orders: Order[];
  onOpenNewOrder: () => void;
  onSyncSheet: () => void;
  isSyncing: boolean;
  onSelectOrder: (order: Order) => void;
  onUpdateOrderStatus: (order: Order, newStatus: OrderStatus) => void;
  onUpdateVariant?: (order: Order, newVariant: string) => void;
  onUpdateSource?: (order: Order, newSource: string) => void;
  onUpdateQuantity?: (order: Order, newQuantity: number) => void;
  onUpdateCourierStatus?: (order: Order, newCourierStatus: string) => void;
  onToggleSteadfast: (order: Order, action?: 'No Sellect' | 'send to steadfast') => Promise<boolean> | void;
  onUpdateCustomerDetails?: (
    order: Order,
    details: {
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      amount?: number;
      price?: number;
    }
  ) => Promise<boolean> | void;
  onDeleteOrder?: (order: Order) => void;
}

type DropdownType = 'variant' | 'source' | 'status';

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onOpenNewOrder,
  onSyncSheet,
  isSyncing,
  onSelectOrder,
  onUpdateOrderStatus,
  onUpdateVariant,
  onUpdateSource,
  onUpdateQuantity,
  onToggleSteadfast,
  onUpdateCustomerDetails,
  onDeleteOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Processing' | 'Completed' | 'On hold' | 'Cancelled' | 'Pending'>('All');

  // Isolated dropdown state: only ONE dropdown on ONE card can be open at a time
  const [activeDropdown, setActiveDropdown] = useState<{
    orderKey: string;
    type: DropdownType;
  } | null>(null);

  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  // Quick Edit Modal State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPrice, setEditPrice] = useState<number>(599);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editVariant, setEditVariant] = useState('No Sellect');
  const [editSource, setEditSource] = useState('Website');
  const [editStatus, setEditStatus] = useState<OrderStatus>('Pending');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveDropdown(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Open Edit Modal for order
  const openEditModal = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setEditingOrder(order);
    setEditName(order.customerName || '');
    setEditPhone(order.customerPhone || '');
    setEditAddress(order.customerAddress || '');
    setEditPrice(order.total || order.amount || 599);
    setEditQuantity(order.quantity || 1);
    setEditVariant(order.variant || 'No Sellect');
    setEditSource(order.source || 'Website');
    setEditStatus(order.status || 'Pending');
  };

  // Save all edited fields directly to Google Sheet
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setIsSavingEdit(true);

    try {
      const order = editingOrder;
      const trackingId = String(order.trackingCode || order.id || '').trim();
      const colM = String(order.steadfastStatus || 'No Select').trim();

      // 1. Dispatch exact requested POST payload with Column A date to Apps Script WEB_APP_URL
      await updateOrderCardViaAppsScript(
        buildOrderCardPayload(order, {
          address: editAddress.trim(),
          number: editPhone.trim(),
          price: Number(editPrice) || 0,
          name: editName.trim(),
          productSelect: editVariant,
          orderSource: editSource,
          orderStatus: editStatus,
          columnMValue: colM,
        })
      );

      const tasks: Promise<any>[] = [];

      // 2. Sync React local state & sheet fallbacks
      if (onUpdateCustomerDetails) {
        tasks.push(
          Promise.resolve(
            onUpdateCustomerDetails(order, {
              customerName: editName.trim(),
              customerPhone: editPhone.trim(),
              customerAddress: editAddress.trim(),
              amount: Number(editPrice) || 0,
              price: Number(editPrice) || 0,
            })
          )
        );
      }

      // Quantity (Col N)
      if (onUpdateQuantity && editQuantity !== order.quantity) {
        tasks.push(Promise.resolve(onUpdateQuantity(order, editQuantity)));
      }

      // Variant (Col H)
      if (onUpdateVariant && editVariant !== order.variant) {
        tasks.push(Promise.resolve(onUpdateVariant(order, editVariant)));
      }

      // Source (Col I)
      if (onUpdateSource && editSource !== order.source) {
        tasks.push(Promise.resolve(onUpdateSource(order, editSource)));
      }

      // Status (Col J)
      if (onUpdateOrderStatus && editStatus !== order.status) {
        tasks.push(Promise.resolve(onUpdateOrderStatus(order, editStatus)));
      }

      await Promise.allSettled(tasks);
      setEditingOrder(null);
    } catch (err) {
      console.error('Error saving order edits:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Generate unique order key so actions NEVER collide
  const getOrderKey = (order: Order, index: number): string => {
    if (order.rowIndex !== undefined && order.rowIndex !== null) {
      return `row-${order.rowIndex}`;
    }
    return `order-${order.id}-${index}`;
  };

  // Toggle 1: Variant (Column H) Styles
  const getVariantStyle = (variant?: string) => {
    const v = (variant || '').toLowerCase();
    if (v.includes('rose 1350') || v.includes('1350')) {
      return 'bg-[#4a1d24] text-[#fca5a5] border-[#882d36]';
    }
    if (v.includes('rose 990') || v.includes('990')) {
      return 'bg-[#3b1828] text-[#f472b6] border-[#6b2345]';
    }
    if (v.includes('rose')) {
      return 'bg-[#40171a] text-[#fca5a5] border-[#742329]';
    }
    if (v.includes('doll') || v.includes('toy')) {
      return 'bg-[#3b2712] text-[#fde047] border-[#664319]';
    }
    if (v.includes('watch 599') || v.includes('watch')) {
      return 'bg-[#3b2d10] text-[#fef08a] border-[#664d17]';
    }
    if (v.includes('cutting') || v.includes('dispancer')) {
      return 'bg-[#153434] text-[#5eead4] border-[#1d5b5b]';
    }
    if (v.includes('golden') || v.includes('combo')) {
      return 'bg-[#221c38] text-[#d8b4fe] border-[#44366e]';
    }
    return 'bg-[#181922] text-gray-400 border-[#2b2d3d]';
  };

  // Toggle 2: Source (Column I) Styles
  const getSourceStyle = (source?: string) => {
    const s = (source || '').toLowerCase();
    if (s.includes('what') || s.includes('হোয়াটসঅ্যাপ')) {
      return 'bg-[#064e3b] text-[#6ee7b7] border-[#047857]';
    }
    if (s.includes('call') || s.includes('phone') || s.includes('ডিরেক্ট')) {
      return 'bg-[#3d2410] text-[#fdba74] border-[#683c16]';
    }
    if (s.includes('mess') || s.includes('মেসেঞ্জার')) {
      return 'bg-[#132d4a] text-[#7dd3fc] border-[#0369a1]';
    }
    if (s.includes('tik') || s.includes('টিকটক')) {
      return 'bg-[#3b1227] text-[#fb7185] border-[#9f1239]';
    }
    if (s.includes('you') || s.includes('ইউটিউব')) {
      return 'bg-[#450a0a] text-[#fca5a5] border-[#991b1b]';
    }
    if (s.includes('incom') || s.includes('ইনকমপ্লিট')) {
      return 'bg-[#3a2211] text-[#fcd34d] border-[#78350f]';
    }
    if (s.includes('fb') || s.includes('facebook')) {
      return 'bg-[#3b172a] text-[#f472b6] border-[#662447]';
    }
    if (s.includes('pend') || s.includes('পেন্ডিং')) {
      return 'bg-[#1e293b] text-[#cbd5e1] border-[#334155]';
    }
    return 'bg-[#152544] text-[#93c5fd] border-[#1e3d70]';
  };

  // Toggle 3: Status (Column J) Styles matching Google Sheet colors
  const getStatusBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('comp') || s.includes('deliv') || s.includes('ডেলিভার্ড')) {
      return {
        label: status || 'Complete',
        badge: 'bg-[#1e3a8a] text-[#bfdbfe] border-[#2563eb]',
        dot: 'bg-[#60a5fa]',
      };
    }
    if (s.includes('proc') || s.includes('প্রসেসিং')) {
      return {
        label: status || 'Procecing',
        badge: 'bg-[#064e3b] text-[#34d399] border-[#059669]',
        dot: 'bg-[#34d399]',
      };
    }
    if (s.includes('hold') || s.includes('হোল্ড')) {
      return {
        label: status || 'Hold',
        badge: 'bg-[#3f2911] text-[#fbbf24] border-[#6b471d]',
        dot: 'bg-[#fbbf24]',
      };
    }
    if (s.includes('cancel') || s.includes('বাতিল') || s.includes('ক্যান্সেল')) {
      return {
        label: status || 'Cancel',
        badge: 'bg-[#451014] text-[#f87171] border-[#782329]',
        dot: 'bg-[#f87171]',
      };
    }
    if (s.includes('review') || s.includes('রিভিউ')) {
      return {
        label: status || 'In Review',
        badge: 'bg-[#1e1b4b] text-[#c7d2fe] border-[#4338ca]',
        dot: 'bg-[#818cf8]',
      };
    }
    if (s.includes('part') || s.includes('আংশিক')) {
      return {
        label: status || 'Partial',
        badge: 'bg-[#134e4a] text-[#5eead4] border-[#0f766e]',
        dot: 'bg-[#2dd4bf]',
      };
    }
    return {
      label: status || 'Pending',
      badge: 'bg-[#35270f] text-[#fde047] border-[#594215]',
      dot: 'bg-[#fde047]',
    };
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchName = (order.customerName || '').toLowerCase().includes(q);
      const matchPhone = (order.customerPhone || '').toLowerCase().includes(q);
      const matchId = (order.id || '').toLowerCase().includes(q);
      const matchProd = (order.product || '').toLowerCase().includes(q);
      const matchVariant = (order.variant || '').toLowerCase().includes(q);
      const matchAddr = (order.customerAddress || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchId && !matchProd && !matchVariant && !matchAddr) {
        return false;
      }
    }

    const s = (order.status || '').toLowerCase();
    if (activeFilter === 'Processing') {
      return s.includes('proc');
    }
    if (activeFilter === 'Completed') {
      return s.includes('comp') || s.includes('deliv');
    }
    if (activeFilter === 'On hold') {
      return s.includes('hold');
    }
    if (activeFilter === 'Cancelled') {
      return s.includes('cancel');
    }
    if (activeFilter === 'Pending') {
      return s.includes('pend');
    }
    return true;
  });

  // Column H (Variant) options - strictly Google Sheet products + No Sellect
  const availableVariants = [
    'No Sellect',
    'Rose 599tk',
    'Doll and toys',
    'Watch 599tk',
    'Porbash Rose 990tk',
    'Porbash Rose 1350tk',
    'Cutting Dispancer',
    'Golden Watch Combo',
  ];

  // Column I (Source) options - verified from Google Sheet
  const availableSources = [
    'Website',
    'Whatsapp',
    'Call Direct',
    'Messenger',
    'Tiktok',
    'Youtube',
    'FB Ads',
    'incomplete',
    'Pending',
  ];

  // Column J (Status) options - verified from Google Sheet
  const availableStatuses: OrderStatus[] = [
    'Procecing',
    'Hold',
    'Complete',
    'Cancel',
    'Pending',
    'In Review',
    'Partial',
  ];

  const handleCopyTracking = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedTracking(code);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  const toggleDropdown = (e: React.MouseEvent, orderKey: string, type: DropdownType) => {
    e.stopPropagation();
    if (activeDropdown?.orderKey === orderKey && activeDropdown?.type === type) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown({ orderKey, type });
    }
  };

  return (
    <div className="space-y-3.5 animate-fadeIn pb-28 sm:pb-20 max-w-4xl mx-auto font-sans">
      {/* WooCommerce Top Header */}
      <div className="bg-[#141419] border-b border-[#24242c] -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 px-4 sm:px-6 py-3.5 sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Orders
          </h1>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-1.5 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Search orders"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={onSyncSheet}
              disabled={isSyncing}
              className="p-1.5 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Sync Google Sheet"
            >
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={onOpenNewOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-pink-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>+ New Order</span>
            </button>
          </div>
        </div>

        {/* Collapsible Search Bar */}
        {isSearchOpen && (
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by #order, name, phone, product, variant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-[#1b1b22] border border-[#2f2f3a] rounded-lg pl-9 pr-8 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Sub Header: Filter Label + Count */}
        <div className="mt-2.5 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-100 flex items-center gap-1.5">
              <span>{activeFilter === 'All' ? 'All orders' : activeFilter}</span>
              <span className="text-xs text-gray-400 font-mono">({filteredOrders.length})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFilter('All')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#202028] hover:bg-[#282834] text-xs font-medium text-gray-300 border border-[#323240] transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Top Status Tabs */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['All', 'Processing', 'Completed', 'On hold', 'Cancelled', 'Pending'] as const).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#152e35] text-[#7de3e0] border border-[#235863] shadow-sm'
                    : 'bg-[#1c1c24] text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List: Feature-complete, interactive cards */}
      <div className="space-y-2 sm:space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="py-16 px-4 text-center bg-[#141418] rounded-xl border border-[#23242c]">
            <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-300">কোনো অর্ডার পাওয়া যায়নি</p>
            <p className="text-xs text-gray-500 mt-1">
              {searchQuery ? 'ভিন্ন শব্দ দিয়ে খুঁজুন' : 'নতুন অর্ডার তৈরি করতে উপরে চাপুন'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order, index) => {
            const orderKey = getOrderKey(order, index);
            const statusStyle = getStatusBadgeStyle(order.status);
            const displayAmount = order.total || order.amount || 599;

            return (
              <div
                key={orderKey}
                onClick={() => onSelectOrder(order)}
                className="bg-[#141419] hover:bg-[#181822] active:bg-[#1c1c28] border border-[#232430] hover:border-[#383a4c] rounded-xl p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer select-none group relative"
              >
                {/* Line 1: Order ID, Row #, Date, Tracking (K), Courier (L), Pen (Edit) Icon, and Status Dropdown (Col J) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                    <span className="text-xs font-mono font-bold text-gray-400 group-hover:text-purple-400 shrink-0">
                      {order.id.startsWith('#') ? order.id : `#${order.id}`}
                    </span>
                    {order.rowIndex && (
                      <span className="text-[10px] text-gray-500 font-mono bg-[#1b1c24] px-1.5 py-0.5 rounded border border-[#262835] shrink-0">
                        Row #{order.rowIndex}
                      </span>
                    )}
                    {order.date && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1 shrink-0">
                        <Calendar className="w-2.5 h-2.5" />
                        {order.date}
                      </span>
                    )}
                  </div>

                  {/* Actions on Top Right: Tracking (K), Courier (L), Pen / Edit Icon + Status Dropdown (Col J) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Tracking Code Badge (Column K) */}
                    {order.trackingCode && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyTracking(e, order.trackingCode!)}
                        className="px-2 py-0.5 rounded bg-[#101b2e] hover:bg-[#16253f] border border-blue-800/40 text-cyan-300 font-mono text-[10px] flex items-center gap-1 cursor-pointer"
                        title="ট্র্যাকিং কোড কপি করুন"
                      >
                        <span>K: {order.trackingCode}</span>
                        {copiedTracking === order.trackingCode ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-gray-400" />
                        )}
                      </button>
                    )}

                    {/* Courier Status (Column L) */}
                    {order.courierStatus && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/40 font-mono shrink-0">
                        L: {order.courierStatus}
                      </span>
                    )}

                    {/* Quick Edit Pen Icon Button */}
                    <button
                      type="button"
                      onClick={(e) => openEditModal(e, order)}
                      className="p-1.5 rounded-lg bg-[#1e2230] hover:bg-[#282e42] text-pink-400 hover:text-pink-300 border border-[#2b334a] transition-all flex items-center justify-center cursor-pointer"
                      title="অর্ডার এডিট করুন (নাম, ফোন, ঠিকানা, কোয়ান্টিটি, ভ্যারিয়েন্ট)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Status Dropdown Button (Column J) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => toggleDropdown(e, orderKey, 'status')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${statusStyle.badge}`}
                        title="J: অর্ডার স্ট্যাটাস পরিবর্তন করুন"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        <span className="text-[10px] opacity-75 font-bold">J:</span>
                        <span>{statusStyle.label}</span>
                        <ChevronDown className="w-3 h-3 opacity-70 ml-0.5 shrink-0" />
                      </button>

                      {/* Dropdown Menu for Status */}
                      {activeDropdown?.orderKey === orderKey && activeDropdown?.type === 'status' && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-44 max-h-60 overflow-y-auto bg-[#181822] border border-[#2f2f40] rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn"
                        >
                          <div className="px-3 py-1 text-[10px] text-gray-400 font-semibold border-b border-[#252535] sticky top-0 bg-[#181822] z-10">
                            J: স্ট্যাটাস সিলেক্ট করুন
                          </div>
                          {availableStatuses.map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateOrderStatus(order, st);
                                setActiveDropdown(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-[#252535] flex items-center justify-between cursor-pointer"
                            >
                              <span>{st}</span>
                              {order.status === st && (
                                <Check className="w-3.5 h-3.5 text-[#7de3e0]" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Line 2: Product Name on Left, Price on Right */}
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-300 font-medium flex-1 min-w-0 pr-2">
                    <span className="truncate block text-gray-300">
                      {order.product || 'Golden Watch Combo'}
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 tracking-tight">
                      {displayAmount}.00 BDT
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Edit Modal for Order Details (Columns F, C, B, D, N, H, I, J, M) */}
      {editingOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setEditingOrder(null)}
        >
          <div
            className="bg-[#14151e] border border-[#2c3044] rounded-2xl w-full max-w-lg shadow-2xl p-4 sm:p-6 space-y-4 my-auto animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#232636]">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-pink-400" />
                  অর্ডার এডিট করুন (শিটে সেভ হবে)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  অর্ডার #{editingOrder.id} • Row #{editingOrder.rowIndex || 2}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#202434] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              {/* Customer Name (Col F) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  গ্রাহকের নাম (Column F):
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="গ্রাহকের নাম লিখুন"
                  required
                  className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              {/* Customer Phone (Col C) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  ফোন নম্বর (Column C):
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  required
                  className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              {/* Customer Address (Col B) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  ডেলিভারি ঠিকানা (Column B):
                </label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="সম্পূর্ণ ডেলিভারি ঠিকানা..."
                  rows={2}
                  required
                  className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              {/* Grid: Price (Col D) & Quantity (Col N) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    মোট মূল্য / COD (Col D):
                  </label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    min={0}
                    className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    অর্ডার পরিমাণ (Col N):
                  </label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(Math.max(1, Number(e.target.value)))}
                    min={1}
                    className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Grid: Variant (Col H) & Source (Col I) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    ভ্যারিয়েন্ট (Column H):
                  </label>
                  <select
                    value={editVariant}
                    onChange={(e) => setEditVariant(e.target.value)}
                    className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                  >
                    {availableVariants.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    অর্ডার সোর্স (Column I):
                  </label>
                  <select
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500"
                  >
                    {availableSources.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status (Col J) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  অর্ডার স্ট্যাটাস (Column J):
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                  className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-500 font-semibold"
                >
                  {availableStatuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#232636]">
                {onDeleteOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('আপনি কি এই অর্ডারটি ডিলিট করতে চান?')) {
                        onDeleteOrder(editingOrder);
                        setEditingOrder(null);
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ডিলিট</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    className="px-4 py-2 rounded-lg bg-[#202434] hover:bg-[#2a3044] text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-pink-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>শিটে সেভ হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>গুগল শিটে সেভ করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
