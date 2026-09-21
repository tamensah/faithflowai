# ChurchTrack Domain Setup Guide

> The primary ChurchTrack domain has not been purchased. Every `churchtrack.example` hostname in this note is a reserved example and must be replaced only after a domain is selected and verified.

## Overview

ChurchTrack provides two types of domain configurations for churches:

1. **Platform Subdomain** (Default & Free)
   - Format: `[church-name].churchtrack.example`
   - Example: `grace.churchtrack.example`
   - Automatically provisioned
   - Includes SSL certificate
   
2. **Custom Domain** (Optional)
   - Format: Your own domain (e.g., `www.gracechurch.org`)
   - Requires additional setup
   - Custom SSL certificate provided

## Platform Subdomain

### Automatic Setup
1. When a church registers on ChurchTrack, a subdomain is automatically generated from the church name:
   - Spaces are replaced with hyphens
   - Special characters are removed
   - Converted to lowercase
   - Numbers are appended if the name is already taken
   
   Examples:
   - "Grace Church" → `grace-church.churchtrack.example`
   - "St. Mary's Cathedral" → `st-marys-cathedral.churchtrack.example`
   - "Grace Church #2" → `grace-church-2.churchtrack.example`

### Technical Implementation
- DNS managed by ChurchTrack
- Automatic SSL certificate provisioning
- Global CDN distribution
- DDoS protection included

## Custom Domain Setup

### Prerequisites
1. Own a registered domain name
2. Access to domain's DNS settings
3. Completed church profile setup on ChurchTrack

### Setup Process

1. **DNS Configuration**
   Add the following DNS records at your domain registrar:

   ```
   # For apex domain (example.com)
   Type: A
   Name: @
   Value: 76.76.21.21

   # For www subdomain
   Type: CNAME
   Name: www
   Value: cname.churchtrack.example
   ```

2. **Domain Verification**
   - Add TXT record for domain ownership verification:
   ```
   Type: TXT
   Name: _faithflow-verify
   Value: [unique-verification-code]
   ```

3. **SSL Certificate**
   - Automatically provisioned once DNS is verified
   - Typically takes 24-48 hours for full propagation

### Custom Domain Best Practices

1. **Recommended Setup**
   - Configure both www and apex domain
   - Set up redirects from apex to www or vice versa
   - Keep DNS records updated

2. **Security**
   - Enable DNSSEC if supported by registrar
   - Use strong registrar account security
   - Monitor DNS changes

3. **Maintenance**
   - Renew domain registration on time
   - Keep contact information updated
   - Monitor SSL certificate expiration

## Troubleshooting

### Common Issues

1. **DNS Not Propagating**
   - Wait 24-48 hours for full propagation
   - Verify DNS records are correct
   - Check for conflicting records

2. **SSL Certificate Issues**
   - Ensure DNS verification is complete
   - Check for CAA records
   - Verify domain ownership

3. **Domain Not Resolving**
   - Verify A/CNAME records
   - Check domain registration status
   - Confirm DNS provider settings

### Support

For domain-related issues:
1. Check DNS propagation: https://dnschecker.org
2. Contact ChurchTrack support: support@churchtrack.example
3. Include domain name and error details

## Domain Management

### Platform Features

1. **Domain Dashboard**
   - View domain status
   - Monitor SSL certificate
   - Check DNS health

2. **Analytics**
   - Traffic monitoring
   - Performance metrics
   - Security alerts

3. **Settings**
   - Custom redirects
   - Force HTTPS
   - Security headers

### Security Features

1. **Included Protection**
   - DDoS mitigation
   - WAF (Web Application Firewall)
   - Bot protection
   - SSL/TLS encryption

2. **Optional Features**
   - Custom security rules
   - IP whitelisting
   - Rate limiting

## Migration Guide

### Moving from Another Platform

1. **Preparation**
   - Backup existing DNS records
   - Document current setup
   - Plan migration timing

2. **Migration Steps**
   - Update DNS records
   - Verify new configuration
   - Monitor traffic transition

3. **Post-Migration**
   - Verify all services working
   - Update internal references
   - Monitor for issues

### Best Practices

1. **Testing**
   - Use development environment
   - Test all functionality
   - Verify email delivery

2. **Backup**
   - Keep old DNS records
   - Document changes
   - Maintain rollback plan

## Technical Reference

### DNS Record Types

```
A Record:
- Points to IP address
- Used for apex domain

CNAME Record:
- Points to another domain
- Used for subdomains

TXT Record:
- Verification
- SPF records
- DKIM records
```

### Required DNS Records

```yaml
# Main domain
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600

# WWW subdomain
Type: CNAME
Name: www
Value: cname.churchtrack.example
TTL: 3600

# Domain verification
Type: TXT
Name: _faithflow-verify
Value: [provided-verification-code]
TTL: 3600
```

### SSL Configuration

- Provider: Let's Encrypt
- Type: Wildcard certificate
- Renewal: Automatic
- Validity: 90 days
