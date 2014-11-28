UUID=atom-dock\@ozonos.org
INSTALLDIR=$(DESTDIR)/usr/share/gnome-shell/extensions/$(UUID)

all:

install: local

local: 
	#Create dir if not exist
	mkdir -p $(INSTALLDIR)

	#Clear dir from contents
	-rm -rf $(INSTALLDIR)/*

	#Copy new contents in
	cp -rf . $(INSTALLDIR)

uninstall:
	#Uninstall atom-dock
	-rm -rf $(INSTALLDIR)

