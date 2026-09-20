export type LoyaltyTier = 'Gold' | 'Silver' | 'Platinum';

export type Customer = {
  id: string;
  name: string;
  loyaltyTier: LoyaltyTier;
  pnr: string;
  email: string;
  phone: string;
  historyFlights12mo: number;
  priorComplaints: string;
};

export type BookingStatus = 'CANCELLED' | 'DELAYED' | 'UNAFFECTED';

export type Booking = {
  pnr: string;
  flight: string;
  route: string;
  date: string;
  scheduledDeparture: string;
  status: BookingStatus;
  statusReason?: string;
  delayHours?: number;
  newDeparture?: string;
};

export const customers: Record<string, Customer> = {
  'SK4821X': {
    id: 'c1',
    name: 'Priya Nair',
    loyaltyTier: 'Gold',
    pnr: 'SK4821X',
    email: 'priya.nair@example.com',
    phone: '+91-98xxxxxxx1',
    historyFlights12mo: 6,
    priorComplaints: '1 prior complaint (delayed baggage, resolved with voucher)',
  },
  'TR1190B': {
    id: 'c2',
    name: 'Arvind Kulkarni',
    loyaltyTier: 'Silver',
    pnr: 'TR1190B',
    email: 'arvind.kulkarni@example.com',
    phone: '+91-98xxxxxxx2',
    historyFlights12mo: 3,
    priorComplaints: 'no prior complaints',
  },
  'WL7742': {
    id: 'c3',
    name: 'Meher Kaur',
    loyaltyTier: 'Platinum',
    pnr: 'WL7742',
    email: 'meher.kaur@example.com',
    phone: '+91-98xxxxxxx3',
    historyFlights12mo: 10,
    priorComplaints: '1 prior complaint (overbooking, resolved with tier upgrade)',
  },
};

export const bookings: Record<string, Booking[]> = {
  'SK4821X': [
    {
      pnr: 'SK4821X',
      flight: 'SK-204',
      route: 'Delhi→Goa',
      date: 'Wed 23 Sep 2026',
      scheduledDeparture: '18:40',
      status: 'CANCELLED',
      statusReason: 'operational reasons',
    },
    {
      pnr: 'SK4821X',
      flight: 'Return',
      route: 'Goa→Delhi',
      date: 'Fri 25 Sep 2026',
      scheduledDeparture: '16:20',
      status: 'UNAFFECTED',
    }
  ],
  'TR1190B': [
    {
      pnr: 'TR1190B',
      flight: 'SK-118',
      route: 'Mumbai→Bengaluru',
      date: 'Wed 23 Sep 2026',
      scheduledDeparture: '07:10',
      status: 'DELAYED',
      delayHours: 4,
      newDeparture: '11:10',
    }
  ],
  'WL7742': [
    {
      pnr: 'WL7742',
      flight: 'SK-305',
      route: 'Delhi→Hyderabad',
      date: 'Wed 23 Sep 2026',
      scheduledDeparture: '14:00',
      status: 'DELAYED',
      delayHours: 6,
      newDeparture: '20:00',
    }
  ]
};

export const getCustomerByPnr = (pnr: string): Customer | undefined => {
  return customers[pnr];
};

export const getBookingsByPnr = (pnr: string): Booking[] | undefined => {
  return bookings[pnr];
};
