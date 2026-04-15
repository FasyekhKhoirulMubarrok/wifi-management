-- FreeRADIUS Standard Tables for rlm_sql (MySQL)
-- Run AFTER Prisma migration:
--   mysql -u root -p fadiljaya_net < prisma/radius-tables.sql
--
-- These tables are managed by FreeRADIUS, NOT Prisma.

USE fadiljaya_net;

-- ─────────────────────────────────────────────
-- radcheck — user credentials & check attributes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radcheck (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username  VARCHAR(64)  NOT NULL DEFAULT '',
  attribute VARCHAR(64)  NOT NULL DEFAULT '',
  op        CHAR(2)      NOT NULL DEFAULT ':=',
  value     VARCHAR(253) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_username (username(32))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- radreply — reply attributes (speed, quota, etc.)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radreply (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username  VARCHAR(64)  NOT NULL DEFAULT '',
  attribute VARCHAR(64)  NOT NULL DEFAULT '',
  op        CHAR(2)      NOT NULL DEFAULT '=',
  value     VARCHAR(253) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_username (username(32))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- radgroupcheck — group check attributes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radgroupcheck (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  groupname VARCHAR(64)  NOT NULL DEFAULT '',
  attribute VARCHAR(64)  NOT NULL DEFAULT '',
  op        CHAR(2)      NOT NULL DEFAULT ':=',
  value     VARCHAR(253) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_groupname (groupname(32))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- radgroupreply — group reply attributes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radgroupreply (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  groupname VARCHAR(64)  NOT NULL DEFAULT '',
  attribute VARCHAR(64)  NOT NULL DEFAULT '',
  op        CHAR(2)      NOT NULL DEFAULT '=',
  value     VARCHAR(253) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_groupname (groupname(32))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- radusergroup — user → group mapping
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radusergroup (
  username  VARCHAR(64) NOT NULL DEFAULT '',
  groupname VARCHAR(64) NOT NULL DEFAULT '',
  priority  INT         NOT NULL DEFAULT 1,
  KEY idx_username (username(32))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- radacct — accounting / session log dari RADIUS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radacct (
  radacctid          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  acctsessionid      VARCHAR(64)     NOT NULL DEFAULT '',
  acctuniqueid       VARCHAR(32)     NOT NULL DEFAULT '',
  username           VARCHAR(64)     NOT NULL DEFAULT '',
  realm              VARCHAR(64)              DEFAULT '',
  nasipaddress       VARCHAR(15)     NOT NULL DEFAULT '',
  nasportid          VARCHAR(15)              DEFAULT NULL,
  nasporttype        VARCHAR(32)              DEFAULT NULL,
  acctstarttime      DATETIME                 DEFAULT NULL,
  acctupdatetime     DATETIME                 DEFAULT NULL,
  acctstoptime       DATETIME                 DEFAULT NULL,
  acctinterval       INT                      DEFAULT NULL,
  acctsessiontime    INT UNSIGNED             DEFAULT NULL,
  acctauthentic      VARCHAR(32)              DEFAULT NULL,
  connectinfo_start  VARCHAR(50)              DEFAULT NULL,
  connectinfo_stop   VARCHAR(50)              DEFAULT NULL,
  acctinputoctets    BIGINT                   DEFAULT NULL,
  acctoutputoctets   BIGINT                   DEFAULT NULL,
  calledstationid    VARCHAR(50)     NOT NULL DEFAULT '',
  callingstationid   VARCHAR(50)     NOT NULL DEFAULT '',
  acctterminatecause VARCHAR(32)     NOT NULL DEFAULT '',
  servicetype        VARCHAR(32)              DEFAULT NULL,
  framedprotocol     VARCHAR(32)              DEFAULT NULL,
  framedipaddress    VARCHAR(15)     NOT NULL DEFAULT '',
  framedipv6address  VARCHAR(45)     NOT NULL DEFAULT '',
  framedipv6prefix   VARCHAR(45)     NOT NULL DEFAULT '',
  framedinterfaceid  VARCHAR(44)     NOT NULL DEFAULT '',
  delegatedipv6prefix VARCHAR(45)   NOT NULL DEFAULT '',
  class              VARCHAR(64)              DEFAULT NULL,
  PRIMARY KEY (radacctid),
  UNIQUE KEY acctuniqueid (acctuniqueid),
  KEY idx_username        (username),
  KEY idx_nasipaddress    (nasipaddress),
  KEY idx_acctsessionid   (acctsessionid),
  KEY idx_acctstarttime   (acctstarttime),
  KEY idx_acctstoptime    (acctstoptime),
  KEY idx_acctinterval    (acctinterval),
  KEY idx_framedipaddress (framedipaddress)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- nas — Network Access Server (MikroTik entries)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nas (
  id          INT          NOT NULL AUTO_INCREMENT,
  nasname     VARCHAR(128) NOT NULL,
  shortname   VARCHAR(32)           DEFAULT NULL,
  type        VARCHAR(30)           DEFAULT 'other',
  ports       INT                   DEFAULT NULL,
  secret      VARCHAR(60)  NOT NULL DEFAULT 'secret',
  server      VARCHAR(64)           DEFAULT NULL,
  community   VARCHAR(50)           DEFAULT NULL,
  description VARCHAR(200)          DEFAULT 'RADIUS Client',
  PRIMARY KEY (id),
  KEY idx_nasname (nasname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
