Name:		atom-dock
Version:	0.1.0
Release:	1%{?dist}
Summary:	A custom dock extension for gnome-shell.
Group:		User Interface/Desktops
License:	GPLv3+
URL:		https://github.com/ozonos/atom-dock
Source0:	atom-dock-0.1.0.tar.gz

%description
 A custom dock extension for gnome-shell. 
 It is a part of Atom Extension Set designed for Ozon OS, 
 though each part of Atom ES is a stand-alone extension. 
 This extension features bottom dock with intellihide, 
 per workspace task separation, transparent background on 
 App Overview, and many other planned features.

%prep
%setup -q

%install
make install DESTDIR=%{buildroot}

%files
%defattr(-,root,root)
%{_datadir}/gnome-shell/extensions/%{name}@ozonos.org

%changelog
* Thu Nov 27 2014 Paolo Rotolo <paolorotolo@ubuntu.com> - 0.1.0-1
- Initial package for Fedora
