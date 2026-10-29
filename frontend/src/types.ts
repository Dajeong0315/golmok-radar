export type DataStatus = {
  store: boolean;
  sales: boolean;
  population: boolean;
};

export type TradeArea = {
  code: string;
  name: string;
  district_name: string;
  area_type_name: string;
  latitude: number;
  longitude: number;
  data_status: DataStatus;
};

