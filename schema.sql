-- 宝宝成长记录 - 数据库建表 SQL
-- 在 Supabase SQL Editor 中执行

-- 1. 宝宝资料表
CREATE TABLE baby_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  nickname TEXT,
  birth_date DATE,
  gender TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 喂养记录表
CREATE TABLE feedings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID REFERENCES baby_profiles(id) ON DELETE CASCADE DEFAULT (SELECT id FROM baby_profiles LIMIT 1),
  feeding_type TEXT NOT NULL CHECK (feeding_type IN ('breastfeeding', 'formula', 'pumped_milk', 'solid_food')),
  amount_ml NUMERIC,
  start_time TIMESTAMP,
  side TEXT CHECK (side IN ('left', 'right', 'both')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 尿布记录表
CREATE TABLE diapers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID REFERENCES baby_profiles(id) ON DELETE CASCADE DEFAULT (SELECT id FROM baby_profiles LIMIT 1),
  time TIMESTAMP,
  type TEXT NOT NULL CHECK (type IN ('pee', 'poop', 'both')),
  color TEXT,
  consistency TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. 生长记录表
CREATE TABLE growth_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID REFERENCES baby_profiles(id) ON DELETE CASCADE DEFAULT (SELECT id FROM baby_profiles LIMIT 1),
  record_date DATE DEFAULT CURRENT_DATE,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,2),
  head_circumference_cm NUMERIC(4,1),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. 维生素记录表
CREATE TABLE vitamin_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baby_id UUID REFERENCES baby_profiles(id) ON DELETE CASCADE DEFAULT (SELECT id FROM baby_profiles LIMIT 1),
  record_date DATE DEFAULT CURRENT_DATE,
  vitamin_type TEXT NOT NULL CHECK (vitamin_type IN ('AD', 'D3')),
  taken BOOLEAN DEFAULT TRUE,
  time TIME,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. AI 聊天历史表
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 开启 RLS（家庭内部使用，全开放）
ALTER TABLE baby_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedings ENABLE ROW LEVEL SECURITY;
ALTER TABLE diapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitamin_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- 允许所有操作
CREATE POLICY "Allow all" ON baby_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON feedings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON diapers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON growth_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON vitamin_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON chat_history FOR ALL USING (true) WITH CHECK (true);
