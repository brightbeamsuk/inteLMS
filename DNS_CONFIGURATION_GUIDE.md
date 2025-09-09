# DNS Configuration Guide for SMTP-Only Email Delivery

## Domain: brightbeams.co.uk

### Required DNS Records for Email Authentication

#### 1. SPF Record (Sender Policy Framework)
**Purpose**: Authorizes which servers can send emails on behalf of your domain.

**DNS Record Type**: TXT
**Host/Name**: @ (root domain)
**Value**: 
```
v=spf1 include:spf.brevo.com -all
```

**Explanation**:
- `v=spf1` - SPF version 1
- `include:spf.brevo.com` - Allow Brevo's servers to send emails
- `-all` - Reject all other servers (strict policy)

#### 2. DKIM Record (DomainKeys Identified Mail)
**Purpose**: Provides email authentication using cryptographic signatures.

**DNS Record Type**: CNAME
**Host/Name**: `[selector]._domainkey` (Brevo will provide the exact selector)
**Value**: [CNAME value provided by Brevo]

**Note**: Log into your Brevo account to get the exact DKIM CNAME record.

#### 3. DMARC Record (Domain-based Message Authentication)
**Purpose**: Tells receiving servers what to do with emails that fail SPF/DKIM checks.

**DNS Record Type**: TXT
**Host/Name**: `_dmarc`
**Value** (Start with monitoring):
```
v=DMARC1; p=none; rua=mailto:dmarc@brightbeams.co.uk; ruf=mailto:dmarc@brightbeams.co.uk; fo=1
```

**Progressive DMARC Policy**:
1. Start: `p=none` (monitoring only)
2. After 1 week: `p=quarantine` (suspicious emails go to spam)
3. After another week: `p=reject` (reject unauthorized emails)

### Verification Steps

#### 1. Check Email Headers
After configuring DNS and sending test emails, verify headers show:
```
Received: from smtp-relay.brevo.com
```
NOT direct server IP like `77.32.148.44`

#### 2. DNS Propagation Check
Use tools like:
- `dig TXT brightbeams.co.uk` (SPF)
- `dig TXT _dmarc.brightbeams.co.uk` (DMARC)
- Online tools: whatsmydns.net, mxtoolbox.com

#### 3. Email Authentication Test
Send test emails to:
- Gmail account
- Hotmail/Outlook account
- Check if emails land in inbox (not spam)

### Expected Results After Configuration
✅ SPF: PASS
✅ DKIM: PASS  
✅ DMARC: PASS
✅ Emails delivered to inbox
✅ Headers show SMTP provider (not direct IP)

### Troubleshooting
- **SPF failures**: Ensure only necessary servers are included
- **DKIM failures**: Verify CNAME record from Brevo is correct
- **DMARC failures**: Check SPF and DKIM are working first
- **Still going to spam**: Allow time for reputation building (24-48 hours)

### Additional Recommendations
1. **Warm up** new SMTP configuration with gradual volume increase
2. **Monitor** email delivery rates and bounce rates
3. **Authenticate** all sending domains properly
4. **Test regularly** with different email providers