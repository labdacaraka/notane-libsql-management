use std::net::{IpAddr, Ipv4Addr, UdpSocket};

/// Gets the primary local network IP address (e.g. 192.168.1.50)
pub fn get_primary_lan_ip() -> Option<String> {
    let probe_targets = [
        "8.8.8.8:80",
        "1.1.1.1:80",
        "192.168.1.1:80",
        "192.168.0.1:80",
        "10.0.0.1:80",
        "172.16.0.1:80",
    ];

    for target in &probe_targets {
        if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
            if socket.connect(target).is_ok() {
                if let Ok(addr) = socket.local_addr() {
                    let ip = addr.ip();
                    if !ip.is_loopback() && matches!(ip, IpAddr::V4(_)) {
                        return Some(ip.to_string());
                    }
                }
            }
        }
    }

    let all = list_all_lan_ips();
    all.into_iter().next()
}

/// Lists all non-loopback IPv4 addresses found on active network interfaces
pub fn list_all_lan_ips() -> Vec<String> {
    let mut results = Vec::new();

    #[cfg(unix)]
    unsafe {
        let mut ifaddrs: *mut libc::ifaddrs = std::ptr::null_mut();
        if libc::getifaddrs(&mut ifaddrs) == 0 && !ifaddrs.is_null() {
            let mut curr = ifaddrs;
            while !curr.is_null() {
                let ifa = *curr;
                if !ifa.ifa_addr.is_null() && (*ifa.ifa_addr).sa_family as i32 == libc::AF_INET {
                    let sin = ifa.ifa_addr as *const libc::sockaddr_in;
                    let ip_num = u32::from_be((*sin).sin_addr.s_addr);
                    let ip = Ipv4Addr::from(ip_num);
                    if !ip.is_loopback() && !ip.is_unspecified() && !ip.is_link_local() {
                        let ip_str = ip.to_string();
                        if !results.contains(&ip_str) {
                            results.push(ip_str);
                        }
                    }
                }
                curr = ifa.ifa_next;
            }
            libc::freeifaddrs(ifaddrs);
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lan_ip_detection() {
        let lan_ip = get_primary_lan_ip();
        println!("Detected LAN IP: {:?}", lan_ip);
        let all_ips = list_all_lan_ips();
        println!("All LAN IPs: {:?}", all_ips);
        // It shouldn't crash
        assert!(lan_ip.is_some() || all_ips.is_empty());
    }
}
